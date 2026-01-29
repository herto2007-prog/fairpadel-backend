import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FixtureService {
  constructor(private prisma: PrismaService) {}

  async generarFixtureCompleto(tournamentId: string) {
    // Verificar que el torneo existe y está en estado PUBLICADO
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        inscripciones: {
          where: { estado: 'CONFIRMADA' },
          include: {
            pareja: true,
            category: true,
          },
        },
        complejos: {
          include: {
            canchas: true,
            horarios: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new BadRequestException('Torneo no encontrado');
    }

    if (tournament.estado !== 'PUBLICADO') {
      throw new BadRequestException('El torneo debe estar en estado PUBLICADO');
    }

    // Cambiar estado del torneo a EN_CURSO
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { estado: 'EN_CURSO' },
    });

    // Generar fixture por cada categoría
    const fixtures = [];

    for (const categoriaRelacion of tournament.categorias) {
      const inscripcionesCategoria = tournament.inscripciones.filter(
        (i) => i.categoryId === categoriaRelacion.categoryId,
      );

      if (inscripcionesCategoria.length === 0) {
        continue; // Saltar categorías sin inscripciones
      }

      const fixtureCategoria = await this.generarFixturePorCategoria(
        tournamentId,
        categoriaRelacion.categoryId,
        inscripcionesCategoria,
        tournament.complejos,
      );

      fixtures.push(fixtureCategoria);
    }

    // TODO: Enviar notificaciones a todos los jugadores

    return {
      tournamentId,
      fixtures,
      message: 'Fixture generado exitosamente',
    };
  }

  private async generarFixturePorCategoria(
    tournamentId: string,
    categoryId: string,
    inscripciones: any[],
    complejos: any[],
  ) {
    // Obtener parejas confirmadas
    const parejas = inscripciones.map((i) => i.pareja);
    const numParejas = parejas.length;

    if (numParejas === 0) {
      return null;
    }

    // Sorteo aleatorio de parejas
    const parejasAleatorias = this.shuffleArray([...parejas]);

    // Calcular número de partidos y rondas
    const numPartidosTotal = this.calcularNumeroPartidos(numParejas);
    const rondas = this.generarRondas(parejasAleatorias);

    // Crear partidos en la base de datos
    const partidos = [];
    let numeroRonda = 1;

    for (const ronda of rondas) {
      for (const enfrentamiento of ronda.enfrentamientos) {
        const partido = await this.prisma.match.create({
          data: {
            tournamentId,
            categoryId,
            ronda: ronda.nombre,
            numeroRonda,
            pareja1Id: enfrentamiento.pareja1?.id || null,
            pareja2Id: enfrentamiento.pareja2?.id || null,
            estado: 'PROGRAMADO',
          },
        });

        partidos.push(partido);
        numeroRonda++;
      }
    }

    // Asignar canchas y horarios (si hay complejos configurados)
    if (complejos.length > 0) {
      await this.asignarCanchasYHorarios(partidos, complejos);
    }

    // Generar partido de ubicación (3er y 4to lugar)
    await this.generarPartidoUbicacion(tournamentId, categoryId, partidos);

    return {
      categoryId,
      numParejas,
      rondas: rondas.map((r) => ({
        nombre: r.nombre,
        numPartidos: r.enfrentamientos.length,
      })),
      partidos,
    };
  }

  private generarRondas(parejas: any[]) {
    const numParejas = parejas.length;
    const rondas = [];

    // Calcular rondas según número de parejas
    // Potencia de 2 más cercana
    let numRondas = Math.ceil(Math.log2(numParejas));
    let capacidad = Math.pow(2, numRondas);

    // Primera ronda
    const primeraRonda = {
      nombre: this.getNombreRonda(numRondas),
      enfrentamientos: [],
    };

    // Asignar parejas a la primera ronda
    for (let i = 0; i < capacidad / 2; i++) {
      const pareja1 = parejas[i * 2] || null;
      const pareja2 = parejas[i * 2 + 1] || null;

      primeraRonda.enfrentamientos.push({
        pareja1,
        pareja2,
      });
    }

    rondas.push(primeraRonda);

    // Generar rondas siguientes (semifinal, final)
    for (let r = numRondas - 1; r > 0; r--) {
      const ronda = {
        nombre: this.getNombreRonda(r),
        enfrentamientos: [],
      };

      const numEnfrentamientos = Math.pow(2, r - 1);
      for (let i = 0; i < numEnfrentamientos; i++) {
        ronda.enfrentamientos.push({
          pareja1: null, // Se llenarán cuando avancen los ganadores
          pareja2: null,
        });
      }

      rondas.push(ronda);
    }

    return rondas;
  }

  private getNombreRonda(nivel: number): string {
    const nombres = {
      1: 'FINAL',
      2: 'SEMIFINAL',
      3: 'CUARTOS',
      4: 'OCTAVOS',
      5: 'DIECISEISAVOS',
    };

    return nombres[nivel] || `RONDA_${nivel}`;
  }

  private calcularNumeroPartidos(numParejas: number): number {
    // En eliminación directa: n-1 partidos + 1 de ubicación
    return numParejas - 1 + 1;
  }

  private shuffleArray(array: any[]): any[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  private async asignarCanchasYHorarios(partidos: any[], complejos: any[]) {
    // Obtener todas las canchas disponibles
    const canchas = complejos.flatMap((c) => c.canchas);
    const horarios = complejos.flatMap((c) => c.horarios);

    if (canchas.length === 0 || horarios.length === 0) {
      return; // No hay canchas u horarios configurados
    }

    // Ordenar horarios por fecha y hora
    horarios.sort((a, b) => {
      const fechaA = new Date(a.fecha + ' ' + a.horaInicio);
      const fechaB = new Date(b.fecha + ' ' + b.horaInicio);
      return fechaA.getTime() - fechaB.getTime();
    });

    // Asignar canchas y horarios de forma secuencial
    let horarioIndex = 0;
    let canchaIndex = 0;

    for (const partido of partidos) {
      if (horarioIndex >= horarios.length) {
        break; // No hay más horarios disponibles
      }

      const horario = horarios[horarioIndex];
      const cancha = canchas[canchaIndex];

      await this.prisma.match.update({
        where: { id: partido.id },
        data: {
          canchaId: cancha.id,
          fechaProgramada: horario.fecha,
          horaProgramada: horario.horaInicio,
          horaFinEstimada: this.calcularHoraFin(horario.horaInicio, 90), // 90 min por partido
        },
      });

      // Rotar canchas
      canchaIndex++;
      if (canchaIndex >= canchas.length) {
        canchaIndex = 0;
        horarioIndex++;
      }
    }
  }

  private calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
    const [horas, minutos] = horaInicio.split(':').map(Number);
    const totalMinutos = horas * 60 + minutos + duracionMinutos;
    const nuevasHoras = Math.floor(totalMinutos / 60);
    const nuevosMinutos = totalMinutos % 60;

    return `${String(nuevasHoras).padStart(2, '0')}:${String(nuevosMinutos).padStart(2, '0')}`;
  }

  private async generarPartidoUbicacion(
    tournamentId: string,
    categoryId: string,
    partidos: any[],
  ) {
    // El partido de ubicación (3er y 4to lugar) se juega entre los perdedores de semifinal
    const semifinales = partidos.filter((p) => p.ronda === 'SEMIFINAL');

    if (semifinales.length !== 2) {
      return; // No se puede generar partido de ubicación
    }

    await this.prisma.match.create({
      data: {
        tournamentId,
        categoryId,
        ronda: 'UBICACION',
        numeroRonda: partidos.length + 1,
        pareja1Id: null, // Se llenará cuando termine semifinal 1
        pareja2Id: null, // Se llenará cuando termine semifinal 2
        estado: 'PROGRAMADO',
      },
    });
  }

  async obtenerFixture(tournamentId: string, categoryId?: string) {
    const where: any = { tournamentId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const partidos = await this.prisma.match.findMany({
      where,
      include: {
        category: true,
        pareja1: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        pareja2: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        parejaGanadora: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        cancha: {
          include: {
            complejo: true,
          },
        },
      },
      orderBy: [
        { numeroRonda: 'asc' },
      ],
    });

    // Agrupar por categoría y ronda
    const fixturePorCategoria = {};

    for (const partido of partidos) {
      const catId = partido.categoryId;
      if (!fixturePorCategoria[catId]) {
        fixturePorCategoria[catId] = {
          category: partido.category,
          rondas: {},
        };
      }

      if (!fixturePorCategoria[catId].rondas[partido.ronda]) {
        fixturePorCategoria[catId].rondas[partido.ronda] = [];
      }

      fixturePorCategoria[catId].rondas[partido.ronda].push(partido);
    }

    return fixturePorCategoria;
  }
}