import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FixtureVersionStatus, RondaTipo, MatchStatus, TournamentCategoryStatus } from '@prisma/client';

export interface GenerarFixtureData {
  tournamentId: string;
  categoryId: string;
}

export interface SlotDefinition {
  id: string;
  ronda: RondaTipo;
  numeroRonda: number;
  orden: number;
  pareja1Id?: string;
  pareja2Id?: string;
  esBye?: boolean;
  partidoSiguienteId?: string;
  posicionEnSiguiente?: 'P1' | 'P2';
}

export interface FixtureDefinicion {
  slots: SlotDefinition[];
  rondas: {
    tipo: RondaTipo;
    cantidadPartidos: number;
  }[];
  reglas: {
    tipoAcomodacion: 'PARAGUAYA';
    rondasAcomodacion: number;
    tercerPuesto: boolean;
  };
}

@Injectable()
export class FixtureService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera un fixture con el sistema de acomodación paraguaya
   * 
   * Fase 1 (Acomodación 1 - R1): Todos juegan
   * - Emparejamiento serpentino
   * - Ganadores → Bracket principal
   * - Perdedores → Acomodación 2
   * 
   * Fase 2 (Acomodación 2 - R2): Solo perdedores de R1
   * - Rankeados por games ganados en R1
   * - Mejor perdedor → BYE directo al bracket
   * - Ganadores R2 → Bracket
   * - Perdedores R2 → Eliminados (ya jugaron 2 partidos)
   * 
   * Fase 3 (Bracket Principal): Potencia de 2
   * - Octavos → Cuartos → Semis → Final
   */
  async generarFixture(data: GenerarFixtureData, organizadorId: string) {
    const { tournamentId, categoryId } = data;

    // Verificar que el organizador es dueño del torneo
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizadorId !== organizadorId) {
      throw new BadRequestException('No tienes permiso para generar el fixture');
    }

    // Obtener inscripciones confirmadas
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: 'CONFIRMADA',
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    if (inscripciones.length < 4) {
      throw new BadRequestException('Se necesitan al menos 4 parejas inscritas para generar el fixture');
    }

    // Calcular siguiente número de versión
    const ultimaVersion = await this.prisma.fixtureVersion.findFirst({
      where: { tournamentId, categoryId },
      orderBy: { version: 'desc' },
    });

    const nuevaVersion = (ultimaVersion?.version || 0) + 1;

    // Generar definición del fixture
    const definicion = this.crearDefinicionAcomodacionParaguaya(inscripciones);

    // Crear FixtureVersion
    const fixtureVersion = await this.prisma.fixtureVersion.create({
      data: {
        tournamentId,
        categoryId,
        version: nuevaVersion,
        estado: FixtureVersionStatus.BORRADOR,
        definicion: definicion as any,
        totalPartidos: definicion.slots.length,
      },
    });

    // Crear los matches basados en la definición
    await this.crearMatchesDesdeDefinicion(fixtureVersion.id, definicion, inscripciones);

    // Actualizar estado de la categoría
    await this.prisma.tournamentCategory.updateMany({
      where: { tournamentId, categoryId },
      data: { estado: TournamentCategoryStatus.FIXTURE_BORRADOR },
    });

    return this.getFixtureById(fixtureVersion.id);
  }

  /**
   * Crea la definición del fixture con sistema de acomodación paraguaya
   */
  private crearDefinicionAcomodacionParaguaya(
    inscripciones: any[],
  ): FixtureDefinicion {
    const totalParejas = inscripciones.length;
    const slots: SlotDefinition[] = [];
    const rondas: { tipo: RondaTipo; cantidadPartidos: number }[] = [];

    // Mezclar aleatoriamente para el primer emparejamiento (seed inicial)
    const parejasMezcladas = [...inscripciones].sort(() => Math.random() - 0.5);
    
    // FASE 1: Acomodación 1 (R1) - Todos juegan
    const partidosR1 = Math.ceil(totalParejas / 2);
    const parejasR1 = [...parejasMezcladas];

    for (let i = 0; i < partidosR1; i++) {
      const pareja1 = parejasR1[i * 2];
      const pareja2 = parejasR1[i * 2 + 1]; // Puede ser undefined si es impar

      slots.push({
        id: `R1-${i + 1}`,
        ronda: RondaTipo.ACOMODACION_1,
        numeroRonda: 1,
        orden: i + 1,
        pareja1Id: pareja1?.id,
        pareja2Id: pareja2?.id,
        esBye: !pareja2, // BYE si no hay pareja 2
      });
    }

    rondas.push({ tipo: RondaTipo.ACOMODACION_1, cantidadPartidos: partidosR1 });

    // FASE 2: Acomodación 2 (R2) - Perdedores de R1
    // Cantidad de perdedores = partidosR1 (ganadores) + posibles BYEs
    const perdedoresR1 = partidosR1; // Aproximación
    const partidosR2 = Math.ceil(perdedoresR1 / 2);

    for (let i = 0; i < partidosR2; i++) {
      slots.push({
        id: `R2-${i + 1}`,
        ronda: RondaTipo.ACOMODACION_2,
        numeroRonda: 2,
        orden: i + 1,
        // Las parejas se asignarán después de R1 según games ganados
      });
    }

    rondas.push({ tipo: RondaTipo.ACOMODACION_2, cantidadPartidos: partidosR2 });

    // Calcular cuántas parejas pasan al bracket principal
    // Ganadores R1 + Ganadores R2 + posible BYE del mejor perdedor
    const clasificadosAlBracket = partidosR1 + partidosR2;
    
    // FASE 3: Bracket Principal - Potencia de 2
    const potencia2Siguiente = this.proximaPotenciaDe2(clasificadosAlBracket);
    const rondasBracket = Math.log2(potencia2Siguiente);

    // Crear bracket de eliminación directa
    let partidosEnRonda = potencia2Siguiente / 2;
    let rondaActual = 3;

    for (let r = 0; r < rondasBracket; r++) {
      let tipoRonda: RondaTipo;
      
      if (partidosEnRonda === 1) tipoRonda = RondaTipo.FINAL;
      else if (partidosEnRonda === 2) tipoRonda = RondaTipo.SEMIS;
      else if (partidosEnRonda === 4) tipoRonda = RondaTipo.CUARTOS;
      else tipoRonda = RondaTipo.OCTAVOS;

      for (let i = 0; i < partidosEnRonda; i++) {
        const slotId = `${tipoRonda}-${i + 1}`;
        const slot: SlotDefinition = {
          id: slotId,
          ronda: tipoRonda,
          numeroRonda: rondaActual,
          orden: i + 1,
        };

        // Conectar con partido siguiente (excepto en la final)
        if (tipoRonda !== RondaTipo.FINAL) {
          const siguienteRondaPartidos = partidosEnRonda / 2;
          const parentIndex = Math.floor(i / 2);
          
          let siguienteRondaTipo: RondaTipo;
          if (siguienteRondaPartidos === 1) siguienteRondaTipo = RondaTipo.FINAL;
          else if (siguienteRondaPartidos === 2) siguienteRondaTipo = RondaTipo.SEMIS;
          else if (siguienteRondaPartidos === 4) siguienteRondaTipo = RondaTipo.CUARTOS;
          else siguienteRondaTipo = RondaTipo.OCTAVOS;

          slot.partidoSiguienteId = `${siguienteRondaTipo}-${parentIndex + 1}`;
          slot.posicionEnSiguiente = i % 2 === 0 ? 'P1' : 'P2';
        }

        slots.push(slot);
      }

      rondas.push({ tipo: tipoRonda, cantidadPartidos: partidosEnRonda });
      partidosEnRonda /= 2;
      rondaActual++;
    }

    // Conectar R1 y R2 con el bracket
    this.conectarAcomodacionConBracket(slots);

    return {
      slots,
      rondas,
      reglas: {
        tipoAcomodacion: 'PARAGUAYA',
        rondasAcomodacion: 2,
        tercerPuesto: true,
      },
    };
  }

  /**
   * Conecta los partidos de acomodación (R1, R2) con el bracket principal
   */
  private conectarAcomodacionConBracket(slots: SlotDefinition[]) {
    const slotsR1 = slots.filter(s => s.ronda === RondaTipo.ACOMODACION_1);
    const slotsR2 = slots.filter(s => s.ronda === RondaTipo.ACOMODACION_2);
    const slotsBracket = slots.filter(s => 
      s.ronda === RondaTipo.OCTAVOS || 
      s.ronda === RondaTipo.CUARTOS || 
      s.ronda === RondaTipo.SEMIS || 
      s.ronda === RondaTipo.FINAL
    );

    // Los ganadores de R1 van al bracket
    // Los ganadores de R2 también van al bracket
    // Distribuimos en el bracket de forma alternada para balancear
    
    let slotBracketIndex = 0;
    
    // Conectar ganadores de R1
    slotsR1.forEach((slotR1, index) => {
      if (slotBracketIndex < slotsBracket.length) {
        const slotBracket = slotsBracket[slotBracketIndex];
        // El ganador de R1 ocupará una posición en el bracket
        // La asignación específica se hará después de conocer los resultados
        slotBracketIndex++;
      }
    });
  }

  /**
   * Crea los registros Match en la base de datos desde la definición
   */
  private async crearMatchesDesdeDefinicion(
    fixtureVersionId: string,
    definicion: FixtureDefinicion,
    inscripciones: any[],
  ) {
    const inscripcionesMap = new Map(inscripciones.map(i => [i.id, i]));

    for (const slot of definicion.slots) {
      const pareja1 = slot.pareja1Id ? inscripcionesMap.get(slot.pareja1Id) : null;
      const pareja2 = slot.pareja2Id ? inscripcionesMap.get(slot.pareja2Id) : null;

      await this.prisma.match.create({
        data: {
          fixtureVersionId,
          tournamentId: '', // Se asigna desde fixtureVersion
          categoryId: '',   // Se asigna desde fixtureVersion
          ronda: slot.ronda,
          numeroRonda: slot.numeroRonda,
          ordenEnRonda: slot.orden,
          pareja1Id: slot.pareja1Id,
          pareja2Id: slot.pareja2Id,
          pareja1Nombre: pareja1 
            ? `${pareja1.jugador1.nombre} ${pareja1.jugador1.apellido} / ${pareja1.jugador2?.nombre || '?'}`
            : null,
          pareja2Nombre: pareja2
            ? `${pareja2.jugador1.nombre} ${pareja2.jugador1.apellido} / ${pareja2.jugador2?.nombre || '?'}`
            : null,
          estado: slot.esBye ? MatchStatus.FINALIZADO : MatchStatus.PROGRAMADO,
          esBye: slot.esBye || false,
          partidoSiguienteId: slot.partidoSiguienteId,
          posicionEnSiguiente: slot.posicionEnSiguiente,
        },
      });
    }

    // Actualizar tournamentId y categoryId en los matches creados
    const fixtureVersion = await this.prisma.fixtureVersion.findUnique({
      where: { id: fixtureVersionId },
    });

    await this.prisma.match.updateMany({
      where: { fixtureVersionId },
      data: {
        tournamentId: fixtureVersion.tournamentId,
        categoryId: fixtureVersion.categoryId,
      },
    });
  }

  /**
   * Publica un fixture borrador
   */
  async publicarFixture(fixtureVersionId: string, organizadorId: string) {
    const fixtureVersion = await this.prisma.fixtureVersion.findUnique({
      where: { id: fixtureVersionId },
      include: { tournament: true },
    });

    if (!fixtureVersion) {
      throw new NotFoundException('Fixture no encontrado');
    }

    if (fixtureVersion.tournament.organizadorId !== organizadorId) {
      throw new BadRequestException('No tienes permiso para publicar este fixture');
    }

    if (fixtureVersion.estado !== FixtureVersionStatus.BORRADOR) {
      throw new BadRequestException('Solo se pueden publicar fixtures en estado borrador');
    }

    // Archivar versiones anteriores publicadas
    await this.prisma.fixtureVersion.updateMany({
      where: {
        tournamentId: fixtureVersion.tournamentId,
        categoryId: fixtureVersion.categoryId,
        estado: FixtureVersionStatus.PUBLICADO,
      },
      data: { estado: FixtureVersionStatus.ARCHIVADO, archivadoAt: new Date() },
    });

    // Publicar nueva versión
    const fixturePublicado = await this.prisma.fixtureVersion.update({
      where: { id: fixtureVersionId },
      data: {
        estado: FixtureVersionStatus.PUBLICADO,
        publicadoAt: new Date(),
      },
    });

    // Actualizar estado de la categoría
    await this.prisma.tournamentCategory.updateMany({
      where: {
        tournamentId: fixtureVersion.tournamentId,
        categoryId: fixtureVersion.categoryId,
      },
      data: { estado: TournamentCategoryStatus.SORTEO_REALIZADO },
    });

    return fixturePublicado;
  }

  /**
   * Obtiene un fixture por ID
   */
  async getFixtureById(fixtureVersionId: string) {
    return this.prisma.fixtureVersion.findUnique({
      where: { id: fixtureVersionId },
      include: {
        tournament: {
          select: { id: true, nombre: true, organizadorId: true },
        },
        category: {
          select: { id: true, nombre: true, tipo: true },
        },
        matches: {
          orderBy: [{ numeroRonda: 'asc' }, { ordenEnRonda: 'asc' }],
          include: {
            pareja1: {
              include: {
                jugador1: { select: { nombre: true, apellido: true } },
                jugador2: { select: { nombre: true, apellido: true } },
              },
            },
            pareja2: {
              include: {
                jugador1: { select: { nombre: true, apellido: true } },
                jugador2: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Obtiene el fixture activo de una categoría
   */
  async getFixtureActivo(tournamentId: string, categoryId: string) {
    return this.prisma.fixtureVersion.findFirst({
      where: {
        tournamentId,
        categoryId,
        estado: FixtureVersionStatus.PUBLICADO,
      },
      include: {
        matches: {
          orderBy: [{ numeroRonda: 'asc' }, { ordenEnRonda: 'asc' }],
          include: {
            pareja1: {
              include: {
                jugador1: { select: { nombre: true, apellido: true } },
                jugador2: { select: { nombre: true, apellido: true } },
              },
            },
            pareja2: {
              include: {
                jugador1: { select: { nombre: true, apellido: true } },
                jugador2: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Calcula la próxima potencia de 2
   */
  private proximaPotenciaDe2(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}
