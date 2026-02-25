import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** Prisma transactional client or regular PrismaService — used to pass tx into helpers */
type PrismaTx = Prisma.TransactionClient;
import {
  calcularHoraFin,
  generarTimeSlots,
  slotKey,
  getRondaOrden,
  parseHoraToMinutes,
  dateKey,
  extractUniqueDays,
  buildRoundDayMap,
  slotIsAfterOrEqual,
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

  async obtenerSeedingParaCategoria(tournamentId: string, categoryId: string, dbClient?: PrismaTx) {
    const db = dbClient || this.prisma;

    // 1. Obtener inscripciones confirmadas con parejas y jugadores
    const inscripciones = await db.inscripcion.findMany({
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
    const rankings = await db.ranking.findMany({
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

  /**
   * Retorna array donde index = seed-1 (0-indexed), value = posición en bracket (0-indexed).
   * Algoritmo determinístico estándar de tenis:
   *   Seed 1 top, Seed 2 bottom, 3-4 cuartos opuestos, 5-8 octavos, etc.
   * Garantiza que Seed 1 vs Seed 2 se encuentran en la final.
   *
   * Para bracket de 8: drawOrder = [1,8,4,5,2,7,3,6]
   *   QF1: S1 vs S8, QF2: S4 vs S5, QF3: S2 vs S7, QF4: S3 vs S6
   */
  private getSeedPositions(bracketSize: number): number[] {
    if (bracketSize <= 1) return [0];

    // Step 1: Generar draw order recursivo (qué seed juega en cada posición)
    const makeDrawOrder = (size: number): number[] => {
      if (size === 1) return [1];
      if (size === 2) return [1, 2];
      const smaller = makeDrawOrder(size / 2);
      const result: number[] = [];
      for (const s of smaller) {
        result.push(s);
        result.push(size + 1 - s);
      }
      return result;
    };

    const drawOrder = makeDrawOrder(bracketSize);

    // Step 2: Invertir → seed-1 → posición
    const positions: number[] = new Array(bracketSize);
    for (let pos = 0; pos < drawOrder.length; pos++) {
      positions[drawOrder[pos] - 1] = pos;
    }

    return positions;
  }

  // ═══════════════════════════════════════════════════════
  // SORTEO POR CATEGORÍA
  // ═══════════════════════════════════════════════════════

  async sortearCategoria(tournamentId: string, categoryId: string, userId?: string, fechaInicio?: string) {
    // ── Validaciones previas (fuera de transacción para fail-fast) ──
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

    // Premium gating: re-sorteo (from FIXTURE_BORRADOR) requires premium or admin
    if (tournamentCategory.estado === 'FIXTURE_BORRADOR' && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const isAdmin = user.roles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin && !user.esPremium) {
        throw new ForbiddenException(
          'Necesitas FairPadel Premium para re-sortear. Contacta a un administrador.',
        );
      }
    }

    const inscripciones = tournament.inscripciones;

    if (inscripciones.length < 8) {
      throw new BadRequestException(
        `Se necesitan al menos 8 parejas confirmadas para el formato de acomodación. Actualmente hay ${inscripciones.length}.`,
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

    // ── Todo el sorteo dentro de transacción atómica ──
    // Si algo falla, no quedan matches huérfanos ni estado inconsistente.
    // Timeout de 30s para brackets grandes.
    const minutosPorPartido = tournament.minutosPorPartido || 60;

    const fixture = await this.prisma.$transaction(
      async (tx) => {
        // Eliminar partidos existentes de esta categoría (safety reset para re-sorteo)
        await tx.match.deleteMany({
          where: { tournamentId, categoryId },
        });

        // Generar fixture con seeding
        const result = await this.generarFixturePorCategoria(
          tx,
          tournamentId,
          categoryId,
          inscripciones,
          tournament.torneoCanchas,
          minutosPorPartido,
          fechaInicio,
        );

        // Categoría va a FIXTURE_BORRADOR (no a SORTEO_REALIZADO)
        // Guardar fechaInicioPartidos para usarla en armarZona2() (R2 scheduling)
        await tx.tournamentCategory.update({
          where: { id: tournamentCategory.id },
          data: {
            estado: 'FIXTURE_BORRADOR',
            inscripcionAbierta: false,
            fechaInicioPartidos: fechaInicio || null,
          },
        });

        return result;
      },
      {
        maxWait: 10000,  // max wait to acquire connection
        timeout: 30000,  // max execution time
      },
    );

    // NO transicionar torneo a EN_CURSO aquí — eso ocurre al publicar

    return {
      tournamentId,
      categoryId,
      fixture,
      scheduling: fixture?.scheduling || { asignados: 0, sinSlot: 0 },
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
    // Ordenar: categorías de menor nivel primero (8va=orden 8, 1ra=orden 1)
    // Así las finales de 8va quedan primero en el último día, y las de 1ra al final
    const sortedCategorias = [...tournament.categorias].sort(
      (a, b) => (b.category?.orden || 0) - (a.category?.orden || 0),
    );

    const fixtures = [];

    for (const categoriaRelacion of sortedCategorias) {
      const inscripcionesCategoria = tournament.inscripciones.filter(
        (i) => i.categoryId === categoriaRelacion.categoryId,
      );

      if (inscripcionesCategoria.length === 0) {
        continue;
      }

      const fixtureCategoria = await this.generarFixturePorCategoria(
        this.prisma,
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

  /** Mayor potencia de 2 que sea ≤ n. Ej: 6→4, 8→8, 10→8, 16→16 */
  private largestPowerOf2(n: number): number {
    let p = 1;
    while (p * 2 <= n) p *= 2;
    return p;
  }

  async generarFixturePorCategoria(
    tx: PrismaTx,
    tournamentId: string,
    categoryId: string,
    inscripciones: any[],
    torneoCanchas: any[],
    minutosPorPartido: number = 60,
    fechaInicio?: string,
  ) {
    const N = inscripciones.length;

    if (N === 0) return null;
    if (N < 8) {
      throw new BadRequestException(
        `Se necesitan al menos 8 parejas para el formato de acomodación. Actualmente hay ${N}.`,
      );
    }
    if (N > 64) {
      throw new BadRequestException(
        `Máximo 64 parejas por categoría. Actualmente hay ${N}.`,
      );
    }

    // === SEEDING (serpentina: seed 1 vs seed N, seed 2 vs seed N-1, etc.) ===
    const seededData = await this.obtenerSeedingParaCategoria(tournamentId, categoryId, tx);

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
    const r1ByePairs: any[] = []; // Parejas con BYE en R1 (van directo al bracket)

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
      const match = await tx.match.create({
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

    // Crear matches R1 BYE para parejas que no juegan R1 (visibilidad en fixture)
    for (const byePair of r1ByePairs) {
      await tx.match.create({
        data: {
          tournamentId,
          categoryId,
          ronda: 'ACOMODACION_1',
          numeroRonda: globalMatchNumber,
          pareja1Id: byePair.id,
          pareja2Id: null,
          estado: 'WO',
          parejaGanadoraId: byePair.id,
          observaciones: 'BYE',
        },
      });
      globalMatchNumber++;
    }

    // ════════════════════════════════════════
    // FASE 2: CÁLCULO DE R2 + PLACEHOLDERS
    // ════════════════════════════════════════
    // Crear R2 placeholders (sin parejas) durante el sorteo para que la columna
    // "Acomodación 2" sea visible en el fixture. Las parejas reales se asignan
    // en armarZona2() después de que todos los R1 terminen (ranking por games).

    // ── Dimensiones correctas: CERO bracket BYEs para cualquier N ──
    // W = R1 winners, B = bracket size (pot de 2), S = slots desde R2, E = entrants R2
    // M = R2 matches reales, BL = best losers (skip R2, BYE al bracket)
    const W = numR1Matches;
    const B = this.largestPowerOf2(N);
    const S = B - W;                                              // slots del bracket que llena R2
    const E = N - W;                                              // entrants a R2 (losers + BYE pairs)
    const numR2Matches = Math.min(S, E - S, Math.floor(E / 2));  // R2 matches reales
    const numBestLosers = S - numR2Matches;                       // skip R2, BYE al bracket
    const bracketSize = B;                                        // SIEMPRE = largestPowerOf2(N)
    const numR2Total = numR2Matches + numBestLosers;              // = S (total R2 placeholders)
    const totalBracketEntrants = bracketSize;                     // siempre = B, sin BYEs

    this.logger.log(
      `[Sorteo] N=${N}, W=${W}, B=${B}, S=${S}, E=${E}, ` +
      `numR2Matches=${numR2Matches}, numBestLosers=${numBestLosers}, bracketSize=${bracketSize}, ` +
      `numR2Total=${numR2Total} (${N !== B ? 'con R2 placeholders' : 'sin R2, losers directo'})`
    );

    // Crear R2 placeholders (matches vacíos) para que el fixture muestre la columna R2
    // Cuando N=B (potencia de 2), no crear R2 → Caso B (losers directo al bracket)
    const createdR2: any[] = [];
    if (numR2Total > 0 && N !== B) {
      for (let i = 0; i < numR2Total; i++) {
        const isBye = i >= numR2Matches; // primeros = partidos reales, últimos = BYE mejor perdedor
        const match = await tx.match.create({
          data: {
            tournamentId,
            categoryId,
            ronda: 'ACOMODACION_2',
            numeroRonda: globalMatchNumber,
            pareja1Id: null,
            pareja2Id: null,
            estado: 'PROGRAMADO',
            observaciones: isBye ? 'PLACEHOLDER_BYE' : 'PLACEHOLDER_R2',
          },
        });
        createdR2.push({ ...match, matchIndex: i });
        globalMatchNumber++;
      }
    }

    // ════════════════════════════════════════
    // FASE 3: BRACKET PRINCIPAL
    // ════════════════════════════════════════
    // bracketSize = B = largestPowerOf2(N), siempre perfecto (CERO BYEs)
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
        const match = await tx.match.create({
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
          await tx.match.update({
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
    // FASE 4: ENLAZAR R1/R2 → BRACKET (con Seed Positions)
    // ════════════════════════════════════════
    // Distribuir parejas/feeders en el bracket usando posiciones de seeding estándar.
    // Seed 1 (top) vs Seed bracketSize (bottom), etc.
    // Esto distribuye BYEs uniformemente (los últimos seeds son los vacíos).
    const bracketFirstRound = createdBracketByRound[0];
    const seedPositions = this.getSeedPositions(bracketSize);

    // Helper: asignar a un slot del bracket según seed position
    const assignToBracket = async (
      seedIdx: number,
      parejaId: string | null,
      feederId: string | null,
      feederType: 'winner' | 'loser',
    ) => {
      const position = seedPositions[seedIdx];
      if (position === undefined) return;
      const bracketMatchIdx = Math.floor(position / 2);
      const bracketPos: 1 | 2 = (position % 2 === 0) ? 1 : 2;
      if (bracketMatchIdx >= bracketFirstRound.length) return;

      if (parejaId) {
        // Pareja conocida: colocar directamente en el bracket
        const campo = bracketPos === 1 ? 'pareja1Id' : 'pareja2Id';
        await tx.match.update({
          where: { id: bracketFirstRound[bracketMatchIdx].id },
          data: { [campo]: parejaId },
        });
        bracketFirstRound[bracketMatchIdx][campo] = parejaId;
      } else if (feederId) {
        // Feeder match: enlazar para llenado dinámico cuando se cargue resultado
        if (feederType === 'winner') {
          await tx.match.update({
            where: { id: feederId },
            data: {
              partidoSiguienteId: bracketFirstRound[bracketMatchIdx].id,
              posicionEnSiguiente: bracketPos,
            },
          });
        } else {
          await tx.match.update({
            where: { id: feederId },
            data: {
              partidoPerdedorSiguienteId: bracketFirstRound[bracketMatchIdx].id,
              posicionEnPerdedor: bracketPos,
            },
          });
        }
      }
    };

    let seedCounter = 0;

    // 1. Ganadores de R1 → bracket (seeds más fuertes, orden por ranking)
    for (let i = 0; i < createdR1.length; i++) {
      await assignToBracket(seedCounter, null, createdR1[i].id, 'winner');
      seedCounter++;
    }

    // 2. R1 BYE pairs (N impar) NO van al bracket directo — jugarán en R2 via armarZona2()
    // (se omite asignación directa para garantizar que toda pareja juegue al menos 1 partido)

    // 3. R2 placeholders → bracket (Caso A) o R1 losers → bracket (Caso B)
    if (createdR2.length > 0) {
      // Caso A: R2 existe — enlazar placeholders como feeders al bracket
      for (const r2Match of createdR2) {
        await assignToBracket(seedCounter, null, r2Match.id, 'winner');
        seedCounter++;
      }
    } else if (numR1Matches > 0) {
      // Caso B: N es potencia de 2 — no hay R2, R1 losers van directo al bracket
      // Anti-reencuentro: loser va a la posición ESPEJO del winner en el bracket
      // Esto garantiza que winner y loser del mismo R1 NUNCA caigan en el mismo bracket match.
      // Ej bracket 8: winner pos 0 (match 0) → loser pos 7 (match 3, mitad opuesta) ✓
      for (let i = 0; i < createdR1.length; i++) {
        const winnerPos = seedPositions[i]; // posición donde fue el winner de R1[i]
        const loserPos = bracketSize - 1 - winnerPos; // posición espejo
        const bracketMatchIdx = Math.floor(loserPos / 2);
        const bracketPos: 1 | 2 = (loserPos % 2 === 0) ? 1 : 2;
        if (bracketMatchIdx < bracketFirstRound.length) {
          await tx.match.update({
            where: { id: createdR1[i].id },
            data: {
              partidoPerdedorSiguienteId: bracketFirstRound[bracketMatchIdx].id,
              posicionEnPerdedor: bracketPos,
            },
          });
        }
      }
    }
    const r2BracketSeedStart = seedCounter;

    // ════════════════════════════════════════
    // FASE 5: AUTO-AVANZAR BYEs DEL BRACKET (con cascade ronda a ronda)
    // ════════════════════════════════════════
    // Procesar TODAS las rondas del bracket (no solo la primera).
    // Después de avanzar BYEs en ronda N, la ronda N+1 puede tener nuevos BYEs
    // porque recibió parejas de ronda N. El procesamiento ronda a ronda
    // resuelve la cascade naturalmente.

    // Helper: contar feeders "vivos" para una posición de un match.
    // Un feeder es "muerto" si estado=WO SIN parejaGanadoraId (phantom match).
    const countActiveFeeders = async (matchId: string, position: number): Promise<number> => {
      const feeders = await tx.match.findMany({
        where: {
          OR: [
            { partidoSiguienteId: matchId, posicionEnSiguiente: position },
            { partidoPerdedorSiguienteId: matchId, posicionEnPerdedor: position },
          ],
        },
        select: { estado: true, parejaGanadoraId: true },
      });
      // Feeder muerto = WO sin ganador (phantom, nunca enviará pareja)
      return feeders.filter(f => !(f.estado === 'WO' && !f.parejaGanadoraId)).length;
    };

    for (let roundIdx = 0; roundIdx < createdBracketByRound.length; roundIdx++) {
      for (const match of createdBracketByRound[roundIdx]) {
        const freshMatch = await tx.match.findUnique({ where: { id: match.id } });
        if (!freshMatch || freshMatch.estado !== 'PROGRAMADO') continue;

        const hasP1 = freshMatch.pareja1Id !== null;
        const hasP2 = freshMatch.pareja2Id !== null;

        if (hasP1 && hasP2) continue; // Match real, se juega normalmente

        if (hasP1 && !hasP2) {
          const active = await countActiveFeeders(freshMatch.id, 2);
          if (active === 0) {
            await this.autoAdvanceByeTx(tx, freshMatch.id, freshMatch.pareja1Id);
          }
        } else if (!hasP1 && hasP2) {
          const active = await countActiveFeeders(freshMatch.id, 1);
          if (active === 0) {
            await this.autoAdvanceByeTx(tx, freshMatch.id, freshMatch.pareja2Id);
          }
        } else {
          // Ambos null — verificar si tiene feeders vivos
          const activePos1 = await countActiveFeeders(freshMatch.id, 1);
          const activePos2 = await countActiveFeeders(freshMatch.id, 2);
          if (activePos1 === 0 && activePos2 === 0) {
            // Match fantasma: sin participantes y sin feeders → marcar WO
            await tx.match.update({
              where: { id: freshMatch.id },
              data: {
                estado: 'WO',
                observaciones: 'BYE - Sin participantes',
              },
            });
            // No propagar — la siguiente ronda detectará el feeder muerto
          }
        }
      }
    }

    // ════════════════════════════════════════
    // FASE 6: ASIGNAR CANCHAS Y HORARIOS
    // ════════════════════════════════════════
    // Solo schedulear R1 upfront. R2 se schedula en armarZona2().
    // Las rondas de bracket (Octavos+) se auto-programan al cargar resultados.
    const matchesToSchedule = createdR1.filter(m => m.estado !== 'WO');
    const allMatches = [...createdR1, ...createdR2, ...createdBracketByRound.flat()];

    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { orden: true },
    });

    // Propagar resultado de scheduling
    let schedulingResult = { asignados: 0, sinSlot: 0 };

    if (torneoCanchas.length > 0) {
      schedulingResult = await this.asignarCanchasYHorarios(
        tx,
        matchesToSchedule,  // solo R1 (R2 y bracket se asignan dinámicamente)
        torneoCanchas,
        tournamentId,
        minutosPorPartido,
        10, // bufferMinutos
        category?.orden,
        fechaInicio,
      );
    }

    // Construir resumen de rondas para retorno
    const rondas = [
      { nombre: 'ACOMODACION_1', numPartidos: createdR1.length },
    ];
    if (createdR2.length > 0) {
      rondas.push({ nombre: 'ACOMODACION_2', numPartidos: createdR2.length });
    }
    for (let roundIdx = 0; roundIdx < createdBracketByRound.length; roundIdx++) {
      rondas.push({
        nombre: this.getNombreRonda(numBracketRondas - roundIdx),
        numPartidos: createdBracketByRound[roundIdx].length,
      });
    }

    return {
      categoryId,
      numParejas: N,
      numR2Matches,
      numBestLosers,
      r2BracketSeedStart,
      bracketSize,
      rondas,
      partidos: allMatches,
      scheduling: schedulingResult,
    };
  }

  // ═══════════════════════════════════════════════════════
  // ARMAR ZONA 2 — Se ejecuta cuando TODOS los R1 de una categoría terminan
  // ═══════════════════════════════════════════════════════

  /**
   * Arma Zona 2 después de que todos los R1 de una categoría están finalizados.
   * ACTUALIZA los R2 placeholders creados durante el sorteo (no crea nuevos).
   * 1. Rankea perdedores de R1 por games ganados (total de los 2-3 sets)
   * 2. Mejor perdedor → directo al bracket (su R2 placeholder se convierte en BYE)
   * 3. Restantes → emparejados serpentina → actualizan R2 placeholder matches
   * 4. Schedula R2 matches
   * 5. Cascade BYEs en bracket
   */
  async armarZona2(tournamentId: string, categoryId: string) {
    // 1. Obtener R2 placeholders (creados durante el sorteo)
    const r2Placeholders = await this.prisma.match.findMany({
      where: { tournamentId, categoryId, ronda: 'ACOMODACION_2' },
      orderBy: { numeroRonda: 'asc' },
    });

    if (r2Placeholders.length === 0) {
      // Caso B: N es potencia de 2 — no hay R2, losers ya enlazados via partidoPerdedorSiguienteId
      this.logger.log(`[ArmarZ2] Sin R2 placeholders para categoría ${categoryId} (N=potencia de 2)`);
      return;
    }

    // Verificar que no estén ya procesados (tienen parejas asignadas)
    const alreadyProcessed = r2Placeholders.some(m =>
      m.pareja1Id !== null && m.observaciones !== 'PLACEHOLDER_BYE' && m.observaciones !== 'PLACEHOLDER_R2'
    );
    if (alreadyProcessed) {
      this.logger.warn(`[ArmarZ2] R2 ya procesado para categoría ${categoryId}, ignorando`);
      return;
    }

    // 2. Obtener R1 matches finalizados
    const r1Matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        ronda: 'ACOMODACION_1',
        estado: { in: ['FINALIZADO', 'WO'] },
      },
      orderBy: { numeroRonda: 'asc' },
    });

    if (r1Matches.length === 0) return;

    // 3. Recolectar perdedores con sus games ganados
    const losers: Array<{
      parejaId: string;
      gamesGanados: number;
      r1MatchId: string;
      r1WinnerId: string;
    }> = [];

    for (const m of r1Matches) {
      if (!m.parejaPerdedoraId || !m.parejaGanadoraId) continue;

      let games = 0;
      const isP1Loser = m.parejaPerdedoraId === m.pareja1Id;
      if (m.set1Pareja1 != null && m.set1Pareja2 != null) {
        games += isP1Loser ? m.set1Pareja1 : m.set1Pareja2;
      }
      if (m.set2Pareja1 != null && m.set2Pareja2 != null) {
        games += isP1Loser ? m.set2Pareja1 : m.set2Pareja2;
      }
      if (m.set3Pareja1 != null && m.set3Pareja2 != null) {
        games += isP1Loser ? m.set3Pareja1 : m.set3Pareja2;
      }

      losers.push({
        parejaId: m.parejaPerdedoraId,
        gamesGanados: games,
        r1MatchId: m.id,
        r1WinnerId: m.parejaGanadoraId,
      });
    }

    // 3b. Incluir R1 BYE pairs (matches WO con observaciones 'BYE' — pareja sin oponente)
    for (const m of r1Matches) {
      if (m.estado === 'WO' && m.observaciones?.includes('BYE') && m.pareja1Id && !m.pareja2Id) {
        if (!losers.some(l => l.parejaId === m.pareja1Id)) {
          losers.push({
            parejaId: m.pareja1Id,
            gamesGanados: -1, // Forzar último ranking — DEBE jugar R2, no ser best loser
            r1MatchId: m.id,
            r1WinnerId: m.pareja1Id,
          });
          this.logger.log(`[ArmarZ2] R1 BYE pair ${m.pareja1Id} agregada a losers con -1 games`);
        }
      }
    }

    // Ordenar por games ganados DESC (mejor perdedor primero, BYE pair al final)
    losers.sort((a, b) => b.gamesGanados - a.gamesGanados);

    // 4. Separar placeholders reales vs BYE
    const realR2 = r2Placeholders.filter(m => m.observaciones === 'PLACEHOLDER_R2');
    const byeR2 = r2Placeholders.filter(m => m.observaciones === 'PLACEHOLDER_BYE');

    this.logger.log(
      `[ArmarZ2] losers=${losers.length}, realR2=${realR2.length}, byeR2=${byeR2.length}`
    );

    // 5. Best losers → asignar a byeR2 placeholders → BYE avance al bracket
    const bestLosers = losers.slice(0, byeR2.length);
    const r2Losers = losers.slice(byeR2.length);

    // 6. Emparejar R2 en serpentina
    const numR2Actual = Math.min(Math.floor(r2Losers.length / 2), realR2.length);

    // 7. Actualizar placeholders dentro de una transacción
    await this.prisma.$transaction(async (tx) => {
      // 7a. Best losers → BYE R2 placeholders → avance directo al bracket
      for (let i = 0; i < bestLosers.length && i < byeR2.length; i++) {
        const placeholder = byeR2[i];
        await tx.match.update({
          where: { id: placeholder.id },
          data: {
            pareja1Id: bestLosers[i].parejaId,
            estado: 'WO',
            parejaGanadoraId: bestLosers[i].parejaId,
            observaciones: 'BYE - Mejor perdedor R1',
          },
        });
        // Auto-advance al bracket via partidoSiguienteId (ya enlazado en el sorteo)
        if (placeholder.partidoSiguienteId && placeholder.posicionEnSiguiente) {
          const campo = placeholder.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';
          await tx.match.update({
            where: { id: placeholder.partidoSiguienteId },
            data: { [campo]: bestLosers[i].parejaId },
          });
        }
      }

      // 7b. Remaining losers → emparejar serpentina → actualizar R2 reales
      for (let i = 0; i < numR2Actual; i++) {
        const p1 = r2Losers[i]; // más fuerte
        const p2 = r2Losers[r2Losers.length - 1 - i]; // más débil
        if (!p1 || !p2 || p1.parejaId === p2.parejaId) continue;

        await tx.match.update({
          where: { id: realR2[i].id },
          data: {
            pareja1Id: p1.parejaId,
            pareja2Id: p2.parejaId,
            observaciones: null, // limpiar PLACEHOLDER_R2
          },
        });
      }

      // 8. Cascade BYEs en bracket (posiciones nuevas pueden generar BYEs)
      const bracketMatches = await tx.match.findMany({
        where: {
          tournamentId,
          categoryId,
          ronda: { notIn: ['ACOMODACION_1', 'ACOMODACION_2'] },
        },
        orderBy: { numeroRonda: 'asc' },
      });

      for (const bm of bracketMatches) {
        const freshMatch = await tx.match.findUnique({ where: { id: bm.id } });
        if (!freshMatch || freshMatch.estado !== 'PROGRAMADO') continue;
        const hasP1 = freshMatch.pareja1Id !== null;
        const hasP2 = freshMatch.pareja2Id !== null;
        if (hasP1 && hasP2) continue;
        if (!hasP1 && !hasP2) {
          const feedersP1 = await tx.match.count({
            where: { OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 1 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 1 },
            ], estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] } },
          });
          const feedersP2 = await tx.match.count({
            where: { OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 2 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 2 },
            ], estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] } },
          });
          if (feedersP1 === 0 && feedersP2 === 0) {
            await tx.match.update({
              where: { id: freshMatch.id },
              data: { estado: 'WO', observaciones: 'BYE - Sin participantes' },
            });
          }
          continue;
        }
        const winnerId = hasP1 ? freshMatch.pareja1Id : freshMatch.pareja2Id;
        const emptyPos = hasP1 ? 2 : 1;
        const feeders = await tx.match.count({
          where: { OR: [
            { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: emptyPos },
            { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: emptyPos },
          ], estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] } },
        });
        if (feeders === 0) {
          await this.autoAdvanceByeTx(tx, freshMatch.id, winnerId!);
        }
      }

      // 9. Schedule R2 matches (solo los que tienen parejas, no los BYE)
      const torneoCanchas = await tx.torneoCancha.findMany({
        where: { tournamentId },
        include: { horarios: true },
      });
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: { minutosPorPartido: true },
      });
      const minutosPorPartido = tournament?.minutosPorPartido || 60;

      // Obtener fechaInicioPartidos guardada durante el sorteo
      const tournamentCat = await tx.tournamentCategory.findFirst({
        where: { tournamentId, categoryId },
        select: { fechaInicioPartidos: true },
      });
      const fechaInicioR2 = tournamentCat?.fechaInicioPartidos || undefined;
      this.logger.log(`[ArmarZ2] R2 scheduling con fechaInicio=${fechaInicioR2 || 'none'}`);

      // Refetch R2 matches with actual pairs
      const r2ToSchedule = await tx.match.findMany({
        where: {
          tournamentId,
          categoryId,
          ronda: 'ACOMODACION_2',
          estado: 'PROGRAMADO',
          pareja1Id: { not: null },
          pareja2Id: { not: null },
        },
      });

      if (torneoCanchas.length > 0 && r2ToSchedule.length > 0) {
        const r2WithRonda = r2ToSchedule.map(m => ({ ...m, ronda: 'ACOMODACION_2' }));
        await this.asignarCanchasYHorarios(
          tx,
          r2WithRonda,
          torneoCanchas,
          tournamentId,
          minutosPorPartido,
          10,
          undefined, // categoryOrden
          fechaInicioR2, // usar fecha guardada durante sorteo
        );
      }
    }, { maxWait: 10000, timeout: 30000 });

    this.logger.log(`[ArmarZ2] Zona 2 armada para categoría ${categoryId}: ${numR2Actual} matches reales, ${bestLosers.length} mejores perdedores`);
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

  /** Transaction-aware version of autoAdvanceBye — used inside $transaction */
  private async autoAdvanceByeTx(tx: PrismaTx, matchId: string, winnerId: string) {
    const match = await tx.match.update({
      where: { id: matchId },
      data: {
        estado: 'WO',
        parejaGanadoraId: winnerId,
        observaciones: 'BYE - Avance automático',
      },
    });

    if (match.partidoSiguienteId && match.posicionEnSiguiente) {
      const campo = match.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';
      await tx.match.update({
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
  private async obtenerSlotsOcupados(tx: PrismaTx, tournamentId: string): Promise<Set<string>> {
    const occupied = new Set<string>();

    const existingMatches = await tx.match.findMany({
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

  // ═══════════════════════════════════════════════════════
  // HELPERS DE SCHEDULING EQUITATIVO
  // ═══════════════════════════════════════════════════════

  /**
   * Cuenta cuántas categorías tiene el torneo (total).
   */
  private async countTournamentCategories(
    tx: PrismaTx,
    tournamentId: string,
  ): Promise<number> {
    return tx.tournamentCategory.count({
      where: { tournamentId },
    });
  }

  /**
   * Cuenta cuántas categorías ya tienen fixture generado
   * (estado diferente a INSCRIPCIONES_ABIERTAS e INSCRIPCIONES_CERRADAS).
   */
  private async countDrawnCategories(
    tx: PrismaTx,
    tournamentId: string,
  ): Promise<number> {
    return tx.tournamentCategory.count({
      where: {
        tournamentId,
        estado: {
          notIn: ['INSCRIPCIONES_ABIERTAS', 'INSCRIPCIONES_CERRADAS'] as any[],
        },
      },
    });
  }

  /**
   * Calcula el presupuesto de slots por día para esta categoría.
   * Divide equitativamente los slots restantes entre las categorías que faltan.
   */
  private calculateDayBudgets(
    allSlots: { fecha: Date }[],
    ocupados: Set<string>,
    allSlotsWithKeys: { key: string; fecha: Date }[],
  ): Map<string, number> {
    const budgets = new Map<string, number>();

    // Contar slots totales y ocupados por día
    const slotsByDay = new Map<string, number>();
    const occupiedByDay = new Map<string, number>();

    for (const slot of allSlotsWithKeys) {
      const dk = dateKey(slot.fecha);
      slotsByDay.set(dk, (slotsByDay.get(dk) || 0) + 1);
      if (ocupados.has(slot.key)) {
        occupiedByDay.set(dk, (occupiedByDay.get(dk) || 0) + 1);
      }
    }

    // Budget = todos los slots libres del día (sin reserva para otras categorías)
    for (const [dk, totalOnDay] of slotsByDay) {
      const occupiedOnDay = occupiedByDay.get(dk) || 0;
      budgets.set(dk, totalOnDay - occupiedOnDay);
    }

    return budgets;
  }

  /**
   * Construye un mapa de cuántos partidos tiene cada pareja por día.
   * Usado para el check de descanso cross-categoría.
   * parejaId → { "YYYY-MM-DD" → count }
   */
  private async buildParejaSchedule(
    tx: PrismaTx,
    tournamentId: string,
  ): Promise<Map<string, Map<string, number>>> {
    const schedule = new Map<string, Map<string, number>>();

    const matches = await tx.match.findMany({
      where: {
        tournamentId,
        estado: { notIn: ['WO', 'CANCELADO'] },
        fechaProgramada: { not: null },
      },
      select: {
        pareja1Id: true,
        pareja2Id: true,
        fechaProgramada: true,
      },
    });

    for (const m of matches) {
      if (!m.fechaProgramada) continue;
      const dk = dateKey(m.fechaProgramada);

      for (const pid of [m.pareja1Id, m.pareja2Id]) {
        if (!pid) continue;
        if (!schedule.has(pid)) schedule.set(pid, new Map());
        const dayMap = schedule.get(pid)!;
        dayMap.set(dk, (dayMap.get(dk) || 0) + 1);
      }
    }

    return schedule;
  }

  // ═══════════════════════════════════════════════════════
  // MOTOR DE SCHEDULING — Algoritmo de 3 fases
  // ═══════════════════════════════════════════════════════

  /**
   * Motor de asignación de canchas y horarios — Scheduling Equitativo.
   *
   * 3 Fases:
   * A. Preparación: roundDayMap, dayBudgets, parejaSchedule
   * B. Asignar FINALES (SEMIFINAL + FINAL) desde pool reverso
   * C. Asignar REGULARES con distribución por días + budget + descanso de parejas
   *
   * Resuelve:
   * - Descanso de jugadores (max N partidos por día, dinámico según inscriptos/días)
   * - Reserva de capacidad (budget por día por categoría)
   * - Distribución ronda→día (ACOM_1 día 1, ACOM_2 día 2, finales último día)
   * - Cross-categoría (slots ocupados compartidos)
   */
  private async asignarCanchasYHorarios(
    tx: PrismaTx,
    partidos: any[],
    torneoCanchas: any[],
    tournamentId: string,
    minutosPorPartido: number,
    bufferMinutos: number = 10,
    categoryOrden?: number,
    fechaInicio?: string,
  ): Promise<{ asignados: number; sinSlot: number }> {
    // ════════════════════════════════════════
    // FASE A: PREPARACIÓN
    // ════════════════════════════════════════

    // A1. Slots ya ocupados globalmente (cross-categoría)
    const ocupados = await this.obtenerSlotsOcupados(tx, tournamentId);

    // A2. Generar todos los time slots (fecha ASC → hora ASC → cancha)
    const allSlotsRaw = generarTimeSlots(torneoCanchas, minutosPorPartido, bufferMinutos);

    // A2b. Filtrar por fechaInicio si se proporcionó (solo usar slots en/después de esa fecha)
    const allSlots = fechaInicio
      ? allSlotsRaw.filter((s) => dateKey(s.fecha) >= fechaInicio)
      : allSlotsRaw;

    this.logger.log(
      `[Scheduling] fechaInicio=${fechaInicio || 'none'}, slotsRaw=${allSlotsRaw.length}, slotsFiltered=${allSlots.length}, partidos=${partidos.length}`
    );

    if (allSlots.length === 0) {
      return { asignados: 0, sinSlot: partidos.length };
    }

    // A3. Mapeo ronda → días preferidos/permitidos (preferencias soft)
    const availableDays = extractUniqueDays(allSlots);
    const roundDayMap = buildRoundDayMap(availableDays);

    // A4. Budget por día (slots libres reales, sin reserva para otras categorías)
    const allSlotsWithKeys = allSlots.map((s) => ({
      ...s,
      key: slotKey(s.torneoCanchaId, s.fecha, s.horaInicio),
    }));
    const dayBudgets = this.calculateDayBudgets(
      allSlots,
      ocupados,
      allSlotsWithKeys,
    );
    const dayBudgetUsed = new Map<string, number>();

    // A5. Schedule de parejas (cuántos partidos por día, cross-categoría)
    const parejaSchedule = await this.buildParejaSchedule(tx, tournamentId);

    // A6. Cancha principal
    const principalCanchaId = torneoCanchas.find((tc) => tc.esPrincipal)?.id || null;

    // A7. Filtrar matches que necesitan slot
    const matchesNeedingSlot = partidos.filter(
      (p) => p.estado !== 'WO' && p.estado !== 'CANCELADO',
    );

    // A8. Límite de partidos por pareja por día: 1 (excepto último día → 2)
    const maxPorDia = 1;
    const lastDayStr = availableDays.length > 0 ? dateKey(availableDays[availableDays.length - 1]) : '';
    const maxPorDiaLastDay = 2; // Semis + Final pueden caer el mismo día

    // A9. Pool reverso para finales (fecha DESC → hora DESC → cancha principal primero)
    const finalSlots = [...allSlots].sort((a, b) => {
      const dateDiff = b.fecha.getTime() - a.fecha.getTime();
      if (dateDiff !== 0) return dateDiff;
      const horaDiff = parseHoraToMinutes(b.horaInicio) - parseHoraToMinutes(a.horaInicio);
      if (horaDiff !== 0) return horaDiff;
      if (principalCanchaId) {
        const aP = a.torneoCanchaId === principalCanchaId ? 0 : 1;
        const bP = b.torneoCanchaId === principalCanchaId ? 0 : 1;
        if (aP !== bP) return aP - bP;
      }
      return a.torneoCanchaId.localeCompare(b.torneoCanchaId);
    });

    let asignados = 0;
    let sinSlot = 0;

    // ════════════════════════════════════════════════════════════════
    // FASE B: SCHEDULING UNIFICADO CON ROUND-FLOOR TRACKING
    // ════════════════════════════════════════════════════════════════
    //
    // Garantía: Ronda N SIEMPRE se programa cronológicamente
    // ANTES que Ronda N+1. El "floor" de cada ronda = el slot más
    // tardío asignado a rondas previas. Es un constraint DURO.

    // B1. Track del último slot por round-order: { fecha, horaFin }
    const roundFloor = new Map<number, { fecha: Date; horaFin: string }>();

    // B2. Helper: actualizar roundFloor (mantener el MÁS TARDÍO)
    const updateRoundFloor = (roundOrden: number, slotFecha: Date, slotHoraFin: string) => {
      const existing = roundFloor.get(roundOrden);
      if (!existing) {
        roundFloor.set(roundOrden, { fecha: slotFecha, horaFin: slotHoraFin });
        return;
      }
      const existingMs = existing.fecha.getTime();
      const newMs = slotFecha.getTime();
      if (newMs > existingMs) {
        roundFloor.set(roundOrden, { fecha: slotFecha, horaFin: slotHoraFin });
      } else if (newMs === existingMs) {
        if (parseHoraToMinutes(slotHoraFin) > parseHoraToMinutes(existing.horaFin)) {
          roundFloor.set(roundOrden, { fecha: slotFecha, horaFin: slotHoraFin });
        }
      }
    };

    // B3. Helper: obtener floor para una ronda = max de todas las rondas con orden < actual
    const getFloorForRound = (currentOrden: number): { fecha: Date | null; horaFin: string | null } => {
      let latestFecha: Date | null = null;
      let latestHoraFin: string | null = null;

      for (const [orden, floor] of roundFloor) {
        if (orden >= currentOrden) continue;
        if (!latestFecha) {
          latestFecha = floor.fecha;
          latestHoraFin = floor.horaFin;
          continue;
        }
        const existingMs = latestFecha.getTime();
        const floorMs = floor.fecha.getTime();
        if (floorMs > existingMs) {
          latestFecha = floor.fecha;
          latestHoraFin = floor.horaFin;
        } else if (floorMs === existingMs) {
          if (parseHoraToMinutes(floor.horaFin) > parseHoraToMinutes(latestHoraFin!)) {
            latestHoraFin = floor.horaFin;
          }
        }
      }

      return { fecha: latestFecha, horaFin: latestHoraFin };
    };

    // B4. Helper: asignar slot + actualizar tracking + actualizar roundFloor
    const assignSlot = async (partido: any, slot: typeof allSlots[0]) => {
      const horaFin = calcularHoraFin(slot.horaInicio, minutosPorPartido);
      await tx.match.update({
        where: { id: partido.id },
        data: {
          torneoCanchaId: slot.torneoCanchaId,
          fechaProgramada: slot.fecha,
          horaProgramada: slot.horaInicio,
          horaFinEstimada: horaFin,
        },
      });

      const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
      const dk = dateKey(slot.fecha);
      ocupados.add(key);
      dayBudgetUsed.set(dk, (dayBudgetUsed.get(dk) || 0) + 1);

      // Actualizar parejaSchedule
      for (const pid of [partido.pareja1Id, partido.pareja2Id]) {
        if (!pid) continue;
        if (!parejaSchedule.has(pid)) parejaSchedule.set(pid, new Map());
        const dayMap = parejaSchedule.get(pid)!;
        dayMap.set(dk, (dayMap.get(dk) || 0) + 1);
      }

      // Actualizar round floor
      const roundOrden = getRondaOrden(partido.ronda);
      updateRoundFloor(roundOrden, slot.fecha, horaFin);

      asignados++;
    };

    // B5. Helpers de validación (sin cambios)
    const parejaExceedsLimit = (parejaIds: string[], dk: string, limit: number): boolean => {
      for (const pid of parejaIds) {
        const sched = parejaSchedule.get(pid);
        if (sched && (sched.get(dk) || 0) >= limit) return true;
      }
      return false;
    };

    const budgetExceeded = (dk: string, multiplier: number = 1): boolean => {
      const budget = dayBudgets.get(dk) || 0;
      const used = dayBudgetUsed.get(dk) || 0;
      return used >= Math.ceil(budget * multiplier);
    };

    // B6. Agrupar TODOS los matches por round-order
    const matchesByRoundOrder = new Map<number, any[]>();
    for (const m of matchesNeedingSlot) {
      const orden = getRondaOrden(m.ronda);
      if (!matchesByRoundOrder.has(orden)) matchesByRoundOrder.set(orden, []);
      matchesByRoundOrder.get(orden)!.push(m);
    }

    // Ordenar matches dentro de cada grupo por numeroRonda
    for (const [, matches] of matchesByRoundOrder) {
      matches.sort((a: any, b: any) => a.numeroRonda - b.numeroRonda);
    }

    // B7. Procesar cada round-order en secuencia estricta (1→2→3→4→5→6→7)
    const roundOrders = [...matchesByRoundOrder.keys()].sort((a, b) => a - b);

    for (const currentOrden of roundOrders) {
      const roundMatches = matchesByRoundOrder.get(currentOrden)!;
      const isFinals = currentOrden >= 6; // SEMIFINAL=6, FINAL=7

      // Floor = slot más tardío de CUALQUIER ronda con orden < actual
      const { fecha: floorFecha, horaFin: floorHoraFin } = getFloorForRound(currentOrden);

      for (const partido of roundMatches) {
        const ronda = partido.ronda;
        const roundConfig = roundDayMap.get(ronda);
        const parejaIds: string[] = [partido.pareja1Id, partido.pareja2Id].filter(Boolean);
        const esFinal = getRondaOrden(ronda) === 7;

        // Validación de slot con round-floor constraint DURO
        const isValidSlot = (
          slot: typeof allSlots[0],
          dayFilter: Date[] | null,
          budgetMult: number,
          parejaLimit: number,
        ): boolean => {
          const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
          const dk = dateKey(slot.fecha);
          if (ocupados.has(key)) return false;
          // CONSTRAINT DURO: slot debe ser >= floor de rondas previas
          if (!slotIsAfterOrEqual(slot.fecha, slot.horaInicio, floorFecha, floorHoraFin)) return false;
          if (dayFilter && !dayFilter.some((d) => dateKey(d) === dk)) return false;
          if (budgetExceeded(dk, budgetMult)) return false;
          // Último día permite más partidos por pareja (semis + final)
          const effectiveLimit = dk === lastDayStr ? Math.max(parejaLimit, maxPorDiaLastDay) : parejaLimit;
          if (parejaIds.length > 0 && parejaExceedsLimit(parejaIds, dk, effectiveLimit)) return false;
          return true;
        };

        let assigned = false;

        if (isFinals) {
          // ── Finales: HARD CONSTRAINT — último día, pool reverso ──
          // Filtrar finalSlots solo al último día
          const lastDayFinalSlots = finalSlots.filter(s => dateKey(s.fecha) === lastDayStr);

          // FINAL: intentar cancha principal primero (último día)
          if (esFinal && principalCanchaId) {
            for (const slot of lastDayFinalSlots) {
              if (slot.torneoCanchaId !== principalCanchaId) continue;
              if (isValidSlot(slot, null, 1.5, maxPorDiaLastDay)) {
                await assignSlot(partido, slot);
                assigned = true;
                break;
              }
            }
          }

          // Último día: cualquier cancha
          if (!assigned) {
            for (const slot of lastDayFinalSlots) {
              if (isValidSlot(slot, null, 1.5, maxPorDiaLastDay)) {
                await assignSlot(partido, slot);
                assigned = true;
                break;
              }
            }
          }

          // Último día: sin restricción de budget (solo slot libre + floor)
          if (!assigned) {
            for (const slot of lastDayFinalSlots) {
              const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
              if (ocupados.has(key)) continue;
              if (!slotIsAfterOrEqual(slot.fecha, slot.horaInicio, floorFecha, floorHoraFin)) continue;
              await assignSlot(partido, slot);
              assigned = true;
              break;
            }
          }

          // Fallback: si no hay slots en último día, usar pool reverso completo
          if (!assigned) {
            for (const slot of finalSlots) {
              const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
              if (ocupados.has(key)) continue;
              if (!slotIsAfterOrEqual(slot.fecha, slot.horaInicio, floorFecha, floorHoraFin)) continue;
              await assignSlot(partido, slot);
              assigned = true;
              break;
            }
          }
        } else {
          // ── Regulares: preferir primeros slots disponibles (forward) ──

          // Nivel 1: Preferred days + budget strict + pareja limit
          if (!assigned && roundConfig) {
            for (const slot of allSlots) {
              if (isValidSlot(slot, roundConfig.preferredDays, 1, maxPorDia)) {
                await assignSlot(partido, slot);
                assigned = true;
                break;
              }
            }
          }

          // Nivel 2: Allowed days (±1 adyacente) + budget strict + pareja limit
          if (!assigned && roundConfig) {
            for (const slot of allSlots) {
              if (isValidSlot(slot, roundConfig.allowedDays, 1, maxPorDia)) {
                await assignSlot(partido, slot);
                assigned = true;
                break;
              }
            }
          }

          // Nivel 3: Cualquier día, budget x1.5, pareja limit +1
          if (!assigned) {
            for (const slot of allSlots) {
              if (isValidSlot(slot, null, 1.5, maxPorDia + 1)) {
                await assignSlot(partido, slot);
                assigned = true;
                break;
              }
            }
          }

          // Nivel 4: Último recurso — cualquier slot libre respetando floor
          if (!assigned) {
            for (const slot of allSlots) {
              const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
              if (ocupados.has(key)) continue;
              if (!slotIsAfterOrEqual(slot.fecha, slot.horaInicio, floorFecha, floorHoraFin)) continue;
              await assignSlot(partido, slot);
              assigned = true;
              break;
            }
          }
        }

        if (!assigned) sinSlot++;
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
