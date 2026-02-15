import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  calcularHoraFin,
  generarTimeSlots,
  slotKey,
  getRondaOrden,
} from './scheduling-utils';

@Injectable()
export class FixtureService {
  private readonly logger = new Logger(FixtureService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // SEEDING: Calcular fuerza de parejas por ranking
  // ═══════════════════════════════════════════════════════

  async obtenerSeedingParaCategoria(tournamentId: string, categoryId: string) {
    // 1. Obtener inscripciones confirmadas con parejas y jugadores
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: 'CONFIRMADA',
      },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
      },
    });

    // 2. Obtener IDs de todos los jugadores
    const playerIds = inscripciones
      .flatMap((i) => [i.pareja.jugador1Id, i.pareja.jugador2Id])
      .filter(Boolean) as string[];

    // 3. Consultar rankings GLOBAL de todos los jugadores
    const rankings = await this.prisma.ranking.findMany({
      where: {
        jugadorId: { in: playerIds },
        tipoRanking: 'GLOBAL',
        alcance: 'GLOBAL',
      },
    });

    // 4. Mapa: jugadorId → puntosTotales
    const rankingMap = new Map<string, number>();
    for (const r of rankings) {
      rankingMap.set(r.jugadorId, r.puntosTotales);
    }

    // 5. Calcular fuerza de cada pareja (suma de ambos jugadores)
    const seededPairs = inscripciones.map((i) => {
      const p1Points = rankingMap.get(i.pareja.jugador1Id) || 0;
      const p2Points = i.pareja.jugador2Id
        ? rankingMap.get(i.pareja.jugador2Id) || 0
        : 0;
      return {
        pareja: i.pareja,
        pairStrength: p1Points + p2Points,
      };
    });

    // 6. Ordenar descendente (más fuerte = seed 1)
    seededPairs.sort((a, b) => b.pairStrength - a.pairStrength);

    // 7. Asignar número de seed
    return seededPairs.map((sp, index) => ({
      ...sp,
      seed: index + 1,
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SEEDING: Posiciones estándar de cabezas de serie
  // ═══════════════════════════════════════════════════════

  private getSeedPositions(bracketSize: number): number[] {
    // Retorna array donde index = seed - 1, value = posición en bracket (0-indexed)
    // Algoritmo estándar de tennis: Seed 1 top, Seed 2 bottom, 3-4 cuartos opuestos, etc.
    const positions: number[] = new Array(bracketSize).fill(-1);

    const fillSeeds = (seeds: number[], slots: number[]) => {
      if (seeds.length === 0 || slots.length === 0) return;
      if (seeds.length === 1) {
        positions[seeds[0] - 1] = slots[0];
        return;
      }
      if (seeds.length === 2) {
        positions[seeds[0] - 1] = slots[0];
        positions[seeds[1] - 1] = slots[slots.length - 1];
        return;
      }

      // Dividir slots en dos mitades
      const mid = Math.floor(slots.length / 2);
      const topHalf = slots.slice(0, mid);
      const bottomHalf = slots.slice(mid);

      // Primer seed va arriba, segundo va abajo
      const topSeeds = [seeds[0]];
      const bottomSeeds = [seeds[1]];

      // Seeds restantes se distribuyen en pares entre mitades (aleatorio)
      const remaining = seeds.slice(2);
      for (let i = 0; i < remaining.length; i += 2) {
        const pair = remaining.slice(i, i + 2);
        if (pair.length === 2 && Math.random() > 0.5) {
          topSeeds.push(pair[1]);
          bottomSeeds.push(pair[0]);
        } else {
          topSeeds.push(pair[0]);
          if (pair[1] !== undefined) bottomSeeds.push(pair[1]);
        }
      }

      fillSeeds(topSeeds, topHalf);
      fillSeeds(bottomSeeds, bottomHalf);
    };

    const allSlots = Array.from({ length: bracketSize }, (_, i) => i);
    const allSeeds = Array.from({ length: bracketSize }, (_, i) => i + 1);

    fillSeeds(allSeeds, allSlots);
    return positions;
  }

  // ═══════════════════════════════════════════════════════
  // SORTEO POR CATEGORÍA
  // ═══════════════════════════════════════════════════════

  async sortearCategoria(tournamentId: string, categoryId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: {
          include: { category: true },
        },
        inscripciones: {
          where: { estado: 'CONFIRMADA', categoryId },
          include: {
            pareja: true,
            category: true,
          },
        },
        torneoCanchas: {
          include: {
            sedeCancha: { include: { sede: true } },
            horarios: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!['PUBLICADO', 'EN_CURSO'].includes(tournament.estado)) {
      throw new BadRequestException(
        'El torneo debe estar PUBLICADO o EN_CURSO para sortear',
      );
    }

    const tournamentCategory = tournament.categorias.find(
      (tc) => tc.categoryId === categoryId,
    );

    if (!tournamentCategory) {
      throw new BadRequestException(
        'Categoría no encontrada en este torneo',
      );
    }

    // Permitir sorteo desde INSCRIPCIONES_CERRADAS o re-sorteo desde FIXTURE_BORRADOR
    if (
      ['SORTEO_REALIZADO', 'EN_CURSO', 'FINALIZADA'].includes(
        tournamentCategory.estado,
      )
    ) {
      throw new BadRequestException(
        'Esta categoría ya tiene fixture publicado. No se puede re-sortear.',
      );
    }

    const inscripciones = tournament.inscripciones;

    if (inscripciones.length < 2) {
      throw new BadRequestException(
        `Se necesitan al menos 2 parejas confirmadas. Actualmente hay ${inscripciones.length}.`,
      );
    }

    // Validar que hay canchas y horarios configurados
    const canchasConHorarios = tournament.torneoCanchas.filter(
      (tc) => tc.horarios && tc.horarios.length > 0,
    );
    if (tournament.torneoCanchas.length === 0) {
      throw new BadRequestException(
        'No hay canchas configuradas para este torneo. Configura las canchas antes de sortear.',
      );
    }
    if (canchasConHorarios.length === 0) {
      throw new BadRequestException(
        'Las canchas no tienen horarios configurados. Configura los horarios antes de sortear.',
      );
    }

    // Eliminar partidos existentes de esta categoría (safety reset para re-sorteo)
    await this.prisma.match.deleteMany({
      where: { tournamentId, categoryId },
    });

    // Generar fixture con seeding — pasar minutosPorPartido del torneo
    const minutosPorPartido = tournament.minutosPorPartido || 60;
    const fixture = await this.generarFixturePorCategoria(
      tournamentId,
      categoryId,
      inscripciones,
      tournament.torneoCanchas,
      minutosPorPartido,
    );

    // Categoría va a FIXTURE_BORRADOR (no a SORTEO_REALIZADO)
    await this.prisma.tournamentCategory.update({
      where: { id: tournamentCategory.id },
      data: {
        estado: 'FIXTURE_BORRADOR',
        inscripcionAbierta: false,
      },
    });

    // NO transicionar torneo a EN_CURSO aquí — eso ocurre al publicar

    return {
      tournamentId,
      categoryId,
      fixture,
      message: 'Sorteo realizado exitosamente. Revisa el fixture y publícalo cuando esté listo.',
    };
  }

  // ═══════════════════════════════════════════════════════
  // PUBLICAR FIXTURE (FIXTURE_BORRADOR → SORTEO_REALIZADO)
  // ═══════════════════════════════════════════════════════

  async publicarFixture(tournamentId: string, categoryId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const tournamentCategory = tournament.categorias.find(
      (tc) => tc.categoryId === categoryId,
    );

    if (!tournamentCategory) {
      throw new BadRequestException('Categoría no encontrada en este torneo');
    }

    if (tournamentCategory.estado !== 'FIXTURE_BORRADOR') {
      throw new BadRequestException(
        'La categoría debe estar en estado FIXTURE_BORRADOR para publicar',
      );
    }

    // Transicionar categoría a SORTEO_REALIZADO
    await this.prisma.tournamentCategory.update({
      where: { id: tournamentCategory.id },
      data: { estado: 'SORTEO_REALIZADO' },
    });

    // Si torneo estaba PUBLICADO → transicionar a EN_CURSO
    if (tournament.estado === 'PUBLICADO') {
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { estado: 'EN_CURSO' },
      });
    }

    // Notificar a todos los jugadores de la primera ronda con partidos programados
    try {
      await this.notificarFixturePublicado(tournamentId, categoryId);
    } catch (e) {
      this.logger.error(`Error notificando fixture publicado: ${e.message}`);
    }

    return {
      message: 'Fixture publicado exitosamente',
      tournamentId,
      categoryId,
    };
  }

  /**
   * Notifica a todos los jugadores de matches de primera ronda (ACOMODACION_1)
   * que tengan ambas parejas y schedule asignado.
   */
  private async notificarFixturePublicado(tournamentId: string, categoryId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) return;

    // Obtener matches de primera ronda con ambas parejas y horario
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        ronda: 'ACOMODACION_1',
        estado: { notIn: ['WO', 'CANCELADO'] },
        pareja1Id: { not: null },
        pareja2Id: { not: null },
      },
      include: {
        pareja1: {
          include: { jugador1: true, jugador2: true },
        },
        pareja2: {
          include: { jugador1: true, jugador2: true },
        },
        torneoCancha: {
          include: {
            sedeCancha: { include: { sede: true } },
          },
        },
      },
    });

    for (const match of matches) {
      const fecha = match.fechaProgramada
        ? new Date(match.fechaProgramada).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })
        : 'Por definir';
      const hora = match.horaProgramada || 'Por definir';
      const cancha = match.torneoCancha?.sedeCancha?.nombre || 'Por definir';
      const sede = match.torneoCancha?.sedeCancha?.sede?.nombre || '';

      // Notificar a los 4 jugadores (2 de cada pareja)
      const jugadores: Array<{ id: string; nombre: string }> = [];
      const p1j1 = match.pareja1?.jugador1;
      const p1j2 = match.pareja1?.jugador2;
      const p2j1 = match.pareja2?.jugador1;
      const p2j2 = match.pareja2?.jugador2;

      // Para pareja1: oponentes son pareja2
      const oponentesP1 = [p2j1?.nombre, p2j2?.nombre].filter(Boolean).join(' / ') || 'Rival';
      const oponentesP2 = [p1j1?.nombre, p1j2?.nombre].filter(Boolean).join(' / ') || 'Rival';

      // Notificar jugadores de pareja1
      for (const jugador of [p1j1, p1j2].filter(Boolean)) {
        try {
          await this.notificacionesService.notificarFixturePublicado(
            jugador.id,
            {
              torneoNombre: tournament.nombre,
              tournamentId,
              oponentes: oponentesP1,
              fecha,
              hora,
              cancha,
              sede,
            },
          );
        } catch (e) {
          this.logger.error(`Error notificando fixture a ${jugador.id}: ${e.message}`);
        }
      }

      // Notificar jugadores de pareja2
      for (const jugador of [p2j1, p2j2].filter(Boolean)) {
        try {
          await this.notificacionesService.notificarFixturePublicado(
            jugador.id,
            {
              torneoNombre: tournament.nombre,
              tournamentId,
              oponentes: oponentesP2,
              fecha,
              hora,
              cancha,
              sede,
            },
          );
        } catch (e) {
          this.logger.error(`Error notificando fixture a ${jugador.id}: ${e.message}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // GENERAR FIXTURE COMPLETO (todas las categorías)
  // ═══════════════════════════════════════════════════════

  async generarFixtureCompleto(tournamentId: string) {
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
        torneoCanchas: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
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

    const minutosPorPartido = tournament.minutosPorPartido || 60;

    // Generar fixture por cada categoría
    const fixtures = [];

    for (const categoriaRelacion of tournament.categorias) {
      const inscripcionesCategoria = tournament.inscripciones.filter(
        (i) => i.categoryId === categoriaRelacion.categoryId,
      );

      if (inscripcionesCategoria.length === 0) {
        continue;
      }

      const fixtureCategoria = await this.generarFixturePorCategoria(
        tournamentId,
        categoriaRelacion.categoryId,
        inscripcionesCategoria,
        tournament.torneoCanchas,
        minutosPorPartido,
      );

      fixtures.push(fixtureCategoria);
    }

    return {
      tournamentId,
      fixtures,
      message: 'Fixture generado exitosamente',
    };
  }

  // ═══════════════════════════════════════════════════════
  // GENERACIÓN DE FIXTURE POR CATEGORÍA — FORMATO ACOMODACIÓN PARAGUAYO
  // Todos juegan mínimo 2 partidos:
  //   Acomodación 1 (R1) → ganadores al bracket, perdedores a R2
  //   Acomodación 2 (R2) → ganadores al bracket, perdedores eliminados
  //   Bracket Principal  → eliminación directa (Octavos/Cuartos/Semi/Final)
  // ═══════════════════════════════════════════════════════

  private nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  async generarFixturePorCategoria(
    tournamentId: string,
    categoryId: string,
    inscripciones: any[],
    torneoCanchas: any[],
    minutosPorPartido: number = 60,
  ) {
    const N = inscripciones.length;

    if (N === 0) return null;
    if (N < 3) {
      throw new BadRequestException(
        'Se necesitan al menos 3 parejas para el formato de acomodación.',
      );
    }

    // === SEEDING (serpentina: seed 1 vs seed N, seed 2 vs seed N-1, etc.) ===
    const seededData = await this.obtenerSeedingParaCategoria(tournamentId, categoryId);

    // Separar ranked y unranked, shuffle unranked
    const rankedPairs = seededData.filter((sp) => sp.pairStrength > 0);
    const unrankedPairs = this.shuffleArray(
      seededData.filter((sp) => sp.pairStrength === 0).map((sp) => sp.pareja),
    );

    // Construir lista ordenada: ranked por seed, luego unranked shuffle
    const orderedPairs: any[] = [
      ...rankedPairs.map((sp) => sp.pareja),
      ...unrankedPairs,
    ];

    // ════════════════════════════════════════
    // FASE 1: ACOMODACIÓN 1 (R1)
    // ════════════════════════════════════════
    // Emparejamiento serpentina: seed 1 vs seed N, seed 2 vs seed N-1...
    const r1Matches: Array<{ pareja1: any; pareja2: any; matchIndex: number }> = [];
    const r1ByePairs: any[] = []; // Parejas con BYE en R1 (van directo a R2)

    const numR1Matches = Math.floor(N / 2);
    for (let i = 0; i < numR1Matches; i++) {
      r1Matches.push({
        pareja1: orderedPairs[i],
        pareja2: orderedPairs[N - 1 - i],
        matchIndex: i,
      });
    }

    // Si N es impar, la pareja del medio recibe BYE
    if (N % 2 !== 0) {
      r1ByePairs.push(orderedPairs[Math.floor(N / 2)]);
    }

    // Crear matches R1 en DB
    const createdR1: any[] = [];
    let globalMatchNumber = 1;

    for (const m of r1Matches) {
      const match = await this.prisma.match.create({
        data: {
          tournamentId,
          categoryId,
          ronda: 'ACOMODACION_1',
          numeroRonda: globalMatchNumber,
          pareja1Id: m.pareja1?.id || null,
          pareja2Id: m.pareja2?.id || null,
          estado: 'PROGRAMADO',
        },
      });
      createdR1.push({ ...match, matchIndex: m.matchIndex });
      globalMatchNumber++;
    }

    // ════════════════════════════════════════
    // FASE 2: ACOMODACIÓN 2 (R2)
    // ════════════════════════════════════════
    // R2 recibe: perdedores de R1 + BYEs de R1
    // Los perdedores se llenan dinámicamente (cuando se carga resultado de R1)
    // Pero necesitamos crear los matches de R2 ahora con slots vacíos
    // y pre-asignar las parejas con BYE de R1

    const numR1Losers = numR1Matches; // cada match R1 produce 1 perdedor
    const totalR2Entrants = numR1Losers + r1ByePairs.length;
    const numR2Matches = Math.floor(totalR2Entrants / 2);
    const r2ByeCount = totalR2Entrants % 2; // 0 o 1

    // Crear matches R2 en DB (slots vacíos — se llenan con perdedores de R1)
    const createdR2: any[] = [];
    for (let i = 0; i < numR2Matches; i++) {
      const match = await this.prisma.match.create({
        data: {
          tournamentId,
          categoryId,
          ronda: 'ACOMODACION_2',
          numeroRonda: globalMatchNumber,
          pareja1Id: null,
          pareja2Id: null,
          estado: 'PROGRAMADO',
        },
      });
      createdR2.push({ ...match, matchIndex: i });
      globalMatchNumber++;
    }

    // Enlazar R1 → R2 (perdedores): cada match R1 envía su perdedor a un match R2
    // IMPORTANTE: Los BYEs de R1 van PRIMERO a R2 para que no reciban otro BYE en R2
    // (si totalR2Entrants es impar, un perdedor de R1 —que ya jugó 1 match— recibe
    // el BYE de R2 y va directo al bracket, NO la pareja con BYE de R1)

    let r2SlotCounter = 0;
    // Índice del R1 match cuyo perdedor recibirá BYE en R2 (va directo al bracket)
    let r2ByeR1MatchIdx = -1;

    // PRIMERO: Pre-asignar BYEs de R1 a los primeros slots de R2
    for (const byePair of r1ByePairs) {
      const r2MatchIdx = Math.floor(r2SlotCounter / 2);
      const r2Pos: 1 | 2 = (r2SlotCounter % 2 === 0) ? 1 : 2;

      if (r2MatchIdx < createdR2.length) {
        const campo = r2Pos === 1 ? 'pareja1Id' : 'pareja2Id';
        await this.prisma.match.update({
          where: { id: createdR2[r2MatchIdx].id },
          data: { [campo]: byePair.id },
        });
        createdR2[r2MatchIdx][campo] = byePair.id;
      }
      r2SlotCounter++;
    }

    // LUEGO: Enlazar perdedores de R1 a los slots restantes de R2
    for (let i = 0; i < createdR1.length; i++) {
      const r2MatchIdx = Math.floor(r2SlotCounter / 2);
      const r2Pos: 1 | 2 = (r2SlotCounter % 2 === 0) ? 1 : 2;

      if (r2MatchIdx < createdR2.length) {
        await this.prisma.match.update({
          where: { id: createdR1[i].id },
          data: {
            partidoPerdedorSiguienteId: createdR2[r2MatchIdx].id,
            posicionEnPerdedor: r2Pos,
          },
        });
      } else {
        // Este perdedor de R1 no cabe en R2 → recibirá BYE de R2
        // Se enlazará directamente al bracket en FASE 4
        r2ByeR1MatchIdx = i;
      }
      r2SlotCounter++;
    }

    // ════════════════════════════════════════
    // FASE 3: BRACKET PRINCIPAL
    // ════════════════════════════════════════
    // Entran: ganadores R1 + ganadores R2 (+ BYEs R2 si hay)
    const ganadoresR1 = numR1Matches; // cada match R1 produce 1 ganador
    const ganadoresR2 = numR2Matches; // cada match R2 produce 1 ganador
    const byesR2Direct = r2ByeCount; // si totalR2Entrants es impar, 1 pareja pasa directo

    const totalBracketEntrants = ganadoresR1 + ganadoresR2 + byesR2Direct;
    const bracketSize = this.nextPowerOf2(totalBracketEntrants);
    const numBracketRondas = Math.ceil(Math.log2(bracketSize));

    // Generar bracket principal (igual que antes, pero con slots vacíos)
    const bracketMatchesByRound: Array<Array<{ pareja1: any; pareja2: any; matchIndex: number }>> = [];

    // Primera ronda del bracket: bracketSize/2 matches
    const firstBracketRound: Array<{ pareja1: any; pareja2: any; matchIndex: number }> = [];
    for (let i = 0; i < bracketSize / 2; i++) {
      firstBracketRound.push({ pareja1: null, pareja2: null, matchIndex: i });
    }
    bracketMatchesByRound.push(firstBracketRound);

    // Rondas siguientes del bracket
    for (let r = numBracketRondas - 1; r >= 1; r--) {
      const numMatches = Math.pow(2, r - 1);
      const roundMatches: Array<{ pareja1: any; pareja2: any; matchIndex: number }> = [];
      for (let i = 0; i < numMatches; i++) {
        roundMatches.push({ pareja1: null, pareja2: null, matchIndex: i });
      }
      bracketMatchesByRound.push(roundMatches);
    }

    // Crear matches del bracket en DB
    const createdBracketByRound: Array<Array<any>> = [];

    for (let roundIdx = 0; roundIdx < bracketMatchesByRound.length; roundIdx++) {
      const roundName = this.getNombreRonda(numBracketRondas - roundIdx);
      const roundMatches = bracketMatchesByRound[roundIdx];
      const createdMatches: any[] = [];

      for (const m of roundMatches) {
        const match = await this.prisma.match.create({
          data: {
            tournamentId,
            categoryId,
            ronda: roundName,
            numeroRonda: globalMatchNumber,
            pareja1Id: null,
            pareja2Id: null,
            estado: 'PROGRAMADO',
          },
        });
        createdMatches.push({ ...match, matchIndex: m.matchIndex });
        globalMatchNumber++;
      }
      createdBracketByRound.push(createdMatches);
    }

    // Enlazar matches del bracket entre sí (ronda a ronda)
    for (let roundIdx = 0; roundIdx < createdBracketByRound.length - 1; roundIdx++) {
      const currentRound = createdBracketByRound[roundIdx];
      const nextRound = createdBracketByRound[roundIdx + 1];

      for (const match of currentRound) {
        const nextMatchIndex = Math.floor(match.matchIndex / 2);
        const nextMatch = nextRound.find((m: any) => m.matchIndex === nextMatchIndex);

        if (nextMatch) {
          const posicion = match.matchIndex % 2 === 0 ? 1 : 2;
          await this.prisma.match.update({
            where: { id: match.id },
            data: {
              partidoSiguienteId: nextMatch.id,
              posicionEnSiguiente: posicion,
            },
          });
        }
      }
    }

    // ════════════════════════════════════════
    // FASE 4: ENLAZAR R1/R2 → BRACKET
    // ════════════════════════════════════════
    // Los ganadores de R1 ocupan los primeros slots del bracket (mejores seeds)
    // Los ganadores de R2 ocupan los slots restantes
    // El perdedor de R1 con BYE en R2 (si hay) ocupa un slot extra
    const bracketFirstRound = createdBracketByRound[0];

    let bracketSlotCounter = 0;

    // Enlazar ganadores de R1 → bracket
    for (let i = 0; i < createdR1.length; i++) {
      const bracketMatchIdx = Math.floor(bracketSlotCounter / 2);
      const bracketPos: 1 | 2 = (bracketSlotCounter % 2 === 0) ? 1 : 2;

      if (bracketMatchIdx < bracketFirstRound.length) {
        await this.prisma.match.update({
          where: { id: createdR1[i].id },
          data: {
            partidoSiguienteId: bracketFirstRound[bracketMatchIdx].id,
            posicionEnSiguiente: bracketPos,
          },
        });
      }
      bracketSlotCounter++;
    }

    // Enlazar ganadores de R2 → bracket
    for (let i = 0; i < createdR2.length; i++) {
      const bracketMatchIdx = Math.floor(bracketSlotCounter / 2);
      const bracketPos: 1 | 2 = (bracketSlotCounter % 2 === 0) ? 1 : 2;

      if (bracketMatchIdx < bracketFirstRound.length) {
        await this.prisma.match.update({
          where: { id: createdR2[i].id },
          data: {
            partidoSiguienteId: bracketFirstRound[bracketMatchIdx].id,
            posicionEnSiguiente: bracketPos,
          },
        });
      }
      bracketSlotCounter++;
    }

    // Si hay BYE de R2 (un perdedor de R1 cuyo loser no tiene match R2),
    // enlazar ese R1 match's loser directamente al bracket
    if (r2ByeR1MatchIdx >= 0) {
      const bracketMatchIdx = Math.floor(bracketSlotCounter / 2);
      const bracketPos: 1 | 2 = (bracketSlotCounter % 2 === 0) ? 1 : 2;

      if (bracketMatchIdx < bracketFirstRound.length) {
        // El perdedor de este R1 match va directo al bracket (BYE en R2)
        await this.prisma.match.update({
          where: { id: createdR1[r2ByeR1MatchIdx].id },
          data: {
            partidoPerdedorSiguienteId: bracketFirstRound[bracketMatchIdx].id,
            posicionEnPerdedor: bracketPos,
          },
        });
      }
      bracketSlotCounter++;
    }

    // ════════════════════════════════════════
    // FASE 5: AUTO-AVANZAR BYEs DEL BRACKET
    // ════════════════════════════════════════
    // Refrescar el estado de la primera ronda del bracket (puede tener BYEs)
    for (const match of bracketFirstRound) {
      // Recargar de DB para tener los datos actualizados
      const freshMatch = await this.prisma.match.findUnique({ where: { id: match.id } });
      if (!freshMatch) continue;

      const hasP1 = freshMatch.pareja1Id !== null;
      const hasP2 = freshMatch.pareja2Id !== null;

      // Solo avanzar BYE si hay exactamente 1 pareja y la otra es null
      // Y solo si ambos slots debieron llenarse (no es un match pendiente de R1/R2)
      // Un match tiene BYE cuando: tiene 1 pareja y ningún match R1/R2 alimenta al slot vacío
      if (hasP1 && !hasP2) {
        // Verificar si alguien va a llenar pareja2Id dinámicamente
        const feedersToPos2 = await this.prisma.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 2 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 2 },
            ],
          },
        });
        if (feedersToPos2 === 0) {
          await this.autoAdvanceBye(freshMatch.id, freshMatch.pareja1Id);
        }
      } else if (!hasP1 && hasP2) {
        const feedersToPos1 = await this.prisma.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 1 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 1 },
            ],
          },
        });
        if (feedersToPos1 === 0) {
          await this.autoAdvanceBye(freshMatch.id, freshMatch.pareja2Id);
        }
      } else if (!hasP1 && !hasP2) {
        // Ambos null — verificar si hay feeders. Si no hay, es match vacío puro → BYE doble
        const anyFeeders = await this.prisma.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id },
              { partidoPerdedorSiguienteId: freshMatch.id },
            ],
          },
        });
        if (anyFeeders === 0) {
          // Match completamente vacío sin feeders — marcar como BYE vacío
          await this.prisma.match.update({
            where: { id: freshMatch.id },
            data: {
              estado: 'WO',
              observaciones: 'BYE - Sin participantes',
            },
          });
        }
      }
    }

    // ════════════════════════════════════════
    // FASE 6: ASIGNAR CANCHAS Y HORARIOS
    // ════════════════════════════════════════
    const allMatches = [...createdR1, ...createdR2, ...createdBracketByRound.flat()];

    if (torneoCanchas.length > 0) {
      await this.asignarCanchasYHorarios(
        allMatches,
        torneoCanchas,
        tournamentId,
        minutosPorPartido,
      );
    }

    // Construir resumen de rondas para retorno
    const rondas = [
      { nombre: 'ACOMODACION_1', numPartidos: createdR1.length },
      { nombre: 'ACOMODACION_2', numPartidos: createdR2.length },
    ];
    for (let roundIdx = 0; roundIdx < createdBracketByRound.length; roundIdx++) {
      rondas.push({
        nombre: this.getNombreRonda(numBracketRondas - roundIdx),
        numPartidos: createdBracketByRound[roundIdx].length,
      });
    }

    return {
      categoryId,
      numParejas: N,
      rondas,
      partidos: allMatches,
    };
  }

  // ═══════════════════════════════════════════════════════
  // AUTO-AVANZAR BYE
  // ═══════════════════════════════════════════════════════

  private async autoAdvanceBye(matchId: string, winnerId: string) {
    // Marcar match como WO con el ganador
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: 'WO',
        parejaGanadoraId: winnerId,
        observaciones: 'BYE - Avance automático',
      },
    });

    // Si hay siguiente partido, colocar ganador en el slot correspondiente
    if (match.partidoSiguienteId && match.posicionEnSiguiente) {
      const campo = match.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';
      await this.prisma.match.update({
        where: { id: match.partidoSiguienteId },
        data: { [campo]: winnerId },
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ═══════════════════════════════════════════════════════

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

  private shuffleArray(array: any[]): any[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  // ═══════════════════════════════════════════════════════
  // SCHEDULING INTELIGENTE (cross-categoría, sin BYEs, minutosPorPartido)
  // ═══════════════════════════════════════════════════════

  /**
   * Obtiene todos los slots ocupados del torneo (todas las categorías).
   * Excluye matches WO y CANCELADO ya que no consumen cancha.
   */
  private async obtenerSlotsOcupados(tournamentId: string): Promise<Set<string>> {
    const occupied = new Set<string>();

    const existingMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { notIn: ['WO', 'CANCELADO'] },
        torneoCanchaId: { not: null },
        horaProgramada: { not: null },
        fechaProgramada: { not: null },
      },
      select: {
        torneoCanchaId: true,
        fechaProgramada: true,
        horaProgramada: true,
      },
    });

    for (const m of existingMatches) {
      if (m.torneoCanchaId && m.fechaProgramada && m.horaProgramada) {
        occupied.add(slotKey(m.torneoCanchaId, m.fechaProgramada, m.horaProgramada));
      }
    }

    return occupied;
  }

  /**
   * Motor de asignación de canchas y horarios.
   * - Cross-categoría: consulta todos los matches existentes del torneo
   * - Salta matches BYE/WO (no necesitan cancha)
   * - Genera time slots discretos desde rangos de disponibilidad
   * - Usa minutosPorPartido configurable (no hardcoded)
   * - Ordena matches por ronda (primera ronda primero)
   */
  private async asignarCanchasYHorarios(
    partidos: any[],
    torneoCanchas: any[],
    tournamentId: string,
    minutosPorPartido: number,
    bufferMinutos: number = 10,
  ): Promise<{ asignados: number; sinSlot: number }> {
    // 1. Cargar slots ya ocupados globalmente (cross-categoría)
    const ocupados = await this.obtenerSlotsOcupados(tournamentId);

    // 2. Generar todos los time slots posibles desde rangos de disponibilidad
    const allSlots = generarTimeSlots(torneoCanchas, minutosPorPartido, bufferMinutos);

    if (allSlots.length === 0) {
      return { asignados: 0, sinSlot: partidos.length };
    }

    // 3. Filtrar: excluir matches WO/BYE (no necesitan cancha)
    const matchesNeedingSlot = partidos.filter(
      (p) => p.estado !== 'WO' && p.estado !== 'CANCELADO',
    );

    // 4. Ordenar matches por ronda (primera ronda primero, final último)
    matchesNeedingSlot.sort((a, b) => {
      const orderA = getRondaOrden(a.ronda);
      const orderB = getRondaOrden(b.ronda);
      if (orderA !== orderB) return orderA - orderB;
      return a.numeroRonda - b.numeroRonda;
    });

    // 5. Asignar primer slot libre a cada match
    let asignados = 0;
    let sinSlot = 0;

    for (const partido of matchesNeedingSlot) {
      let assigned = false;

      for (const slot of allSlots) {
        const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
        if (!ocupados.has(key)) {
          // Slot disponible → asignar
          await this.prisma.match.update({
            where: { id: partido.id },
            data: {
              torneoCanchaId: slot.torneoCanchaId,
              fechaProgramada: slot.fecha,
              horaProgramada: slot.horaInicio,
              horaFinEstimada: calcularHoraFin(slot.horaInicio, minutosPorPartido),
            },
          });

          // Marcar como ocupado
          ocupados.add(key);
          asignados++;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        sinSlot++;
      }
    }

    return { asignados, sinSlot };
  }

  // ELIMINADO: generarPartidoUbicacion — No se juega 3er/4to puesto en formato paraguayo

  // ═══════════════════════════════════════════════════════
  // OBTENER FIXTURE PÚBLICO (solo categorías publicadas)
  // ═══════════════════════════════════════════════════════

  async obtenerFixturePublico(tournamentId: string, categoryId?: string) {
    // Obtener categorías con fixture publicado (SORTEO_REALIZADO, EN_CURSO, FINALIZADA)
    const estadosPublicados = ['SORTEO_REALIZADO', 'EN_CURSO', 'FINALIZADA'];
    const tournamentCategories = await this.prisma.tournamentCategory.findMany({
      where: {
        tournamentId,
        estado: { in: estadosPublicados as any },
        ...(categoryId ? { categoryId } : {}),
      },
      select: { categoryId: true },
    });

    const publishedCategoryIds = tournamentCategories.map(tc => tc.categoryId);

    if (publishedCategoryIds.length === 0) {
      return {};
    }

    const where: any = {
      tournamentId,
      categoryId: { in: publishedCategoryIds },
    };
    if (categoryId && publishedCategoryIds.includes(categoryId)) {
      where.categoryId = categoryId;
    } else if (categoryId) {
      return {}; // Requested category is not published
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
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
      orderBy: [{ numeroRonda: 'asc' }],
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

  // OBTENER FIXTURE (interno, incluye borradores para admin/organizer)
  // ═══════════════════════════════════════════════════════

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
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
      orderBy: [{ numeroRonda: 'asc' }],
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
