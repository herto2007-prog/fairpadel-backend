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

  async sortearCategoria(tournamentId: string, categoryId: string, userId?: string) {
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
        );

        // Categoría va a FIXTURE_BORRADOR (no a SORTEO_REALIZADO)
        await tx.tournamentCategory.update({
          where: { id: tournamentCategory.id },
          data: {
            estado: 'FIXTURE_BORRADOR',
            inscripcionAbierta: false,
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

  async generarFixturePorCategoria(
    tx: PrismaTx,
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
      const match = await tx.match.create({
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
        await tx.match.update({
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
        await tx.match.update({
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
        await tx.match.update({
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
        await tx.match.update({
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
        await tx.match.update({
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
      const freshMatch = await tx.match.findUnique({ where: { id: match.id } });
      if (!freshMatch) continue;

      const hasP1 = freshMatch.pareja1Id !== null;
      const hasP2 = freshMatch.pareja2Id !== null;

      // Solo avanzar BYE si hay exactamente 1 pareja y la otra es null
      // Y solo si ambos slots debieron llenarse (no es un match pendiente de R1/R2)
      // Un match tiene BYE cuando: tiene 1 pareja y ningún match R1/R2 alimenta al slot vacío
      if (hasP1 && !hasP2) {
        // Verificar si alguien va a llenar pareja2Id dinámicamente
        const feedersToPos2 = await tx.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 2 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 2 },
            ],
          },
        });
        if (feedersToPos2 === 0) {
          await this.autoAdvanceByeTx(tx, freshMatch.id, freshMatch.pareja1Id);
        }
      } else if (!hasP1 && hasP2) {
        const feedersToPos1 = await tx.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id, posicionEnSiguiente: 1 },
              { partidoPerdedorSiguienteId: freshMatch.id, posicionEnPerdedor: 1 },
            ],
          },
        });
        if (feedersToPos1 === 0) {
          await this.autoAdvanceByeTx(tx, freshMatch.id, freshMatch.pareja2Id);
        }
      } else if (!hasP1 && !hasP2) {
        // Ambos null — verificar si hay feeders. Si no hay, es match vacío puro → BYE doble
        const anyFeeders = await tx.match.count({
          where: {
            OR: [
              { partidoSiguienteId: freshMatch.id },
              { partidoPerdedorSiguienteId: freshMatch.id },
            ],
          },
        });
        if (anyFeeders === 0) {
          // Match completamente vacío sin feeders — marcar como BYE vacío
          await tx.match.update({
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

    // Obtener orden de la categoría para scheduling inteligente
    // (8va=8, 1ra=1 — se sortea 8va primero para que sus finales queden antes)
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { orden: true },
    });

    if (torneoCanchas.length > 0) {
      await this.asignarCanchasYHorarios(
        tx,
        allMatches,
        torneoCanchas,
        tournamentId,
        minutosPorPartido,
        10, // bufferMinutos
        category?.orden,
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
    totalCategories: number,
    drawnCategories: number,
  ): Map<string, number> {
    const budgets = new Map<string, number>();
    const categoriesRemaining = Math.max(1, totalCategories - drawnCategories);

    // Group slots by date
    const slotsByDay = new Map<string, number>();
    const occupiedByDay = new Map<string, number>();

    for (const slot of allSlotsWithKeys) {
      const dk = dateKey(slot.fecha);
      slotsByDay.set(dk, (slotsByDay.get(dk) || 0) + 1);
      if (ocupados.has(slot.key)) {
        occupiedByDay.set(dk, (occupiedByDay.get(dk) || 0) + 1);
      }
    }

    for (const [dk, totalOnDay] of slotsByDay) {
      const occupiedOnDay = occupiedByDay.get(dk) || 0;
      const remaining = totalOnDay - occupiedOnDay;

      if (categoriesRemaining <= 1) {
        // Last category — no budget limit, take all remaining
        budgets.set(dk, remaining);
      } else {
        budgets.set(dk, Math.max(1, Math.floor(remaining / categoriesRemaining)));
      }
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
  ): Promise<{ asignados: number; sinSlot: number }> {
    // ════════════════════════════════════════
    // FASE A: PREPARACIÓN
    // ════════════════════════════════════════

    // A1. Slots ya ocupados globalmente (cross-categoría)
    const ocupados = await this.obtenerSlotsOcupados(tx, tournamentId);

    // A2. Generar todos los time slots (fecha ASC → hora ASC → cancha)
    const allSlots = generarTimeSlots(torneoCanchas, minutosPorPartido, bufferMinutos);
    if (allSlots.length === 0) {
      return { asignados: 0, sinSlot: partidos.length };
    }

    // A3. Mapeo ronda → días del torneo
    const availableDays = extractUniqueDays(allSlots);
    const roundDayMap = buildRoundDayMap(availableDays);

    // A4. Budget por día por categoría (reserva capacidad para categorías no sorteadas)
    const totalCats = await this.countTournamentCategories(tx, tournamentId);
    const drawnCats = await this.countDrawnCategories(tx, tournamentId);
    const allSlotsWithKeys = allSlots.map((s) => ({
      ...s,
      key: slotKey(s.torneoCanchaId, s.fecha, s.horaInicio),
    }));
    const dayBudgets = this.calculateDayBudgets(
      allSlots,
      ocupados,
      allSlotsWithKeys,
      totalCats,
      drawnCats,
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

    // A8. Límite dinámico de partidos por pareja por día
    //     Adapta según proporción matches/días. Tope absoluto: 3
    const maxPorDia = Math.min(
      3,
      Math.max(1, Math.ceil(matchesNeedingSlot.length / Math.max(1, availableDays.length))),
    );

    // A9. Separar en 2 grupos: regulares vs finales
    const regularMatches: any[] = [];
    const finalMatches: any[] = [];
    for (const m of matchesNeedingSlot) {
      if (getRondaOrden(m.ronda) >= 6) {
        finalMatches.push(m);
      } else {
        regularMatches.push(m);
      }
    }

    // Ordenar regulares: primera ronda primero
    regularMatches.sort((a, b) => {
      const diff = getRondaOrden(a.ronda) - getRondaOrden(b.ronda);
      return diff !== 0 ? diff : a.numeroRonda - b.numeroRonda;
    });

    // Ordenar finales: FINAL primero (para que ocupe el último slot)
    finalMatches.sort((a, b) => {
      const diff = getRondaOrden(b.ronda) - getRondaOrden(a.ronda);
      return diff !== 0 ? diff : a.numeroRonda - b.numeroRonda;
    });

    let asignados = 0;
    let sinSlot = 0;

    // ── Helper: asignar slot + actualizar tracking ──
    const assignSlot = async (partido: any, slot: typeof allSlots[0]) => {
      await tx.match.update({
        where: { id: partido.id },
        data: {
          torneoCanchaId: slot.torneoCanchaId,
          fechaProgramada: slot.fecha,
          horaProgramada: slot.horaInicio,
          horaFinEstimada: calcularHoraFin(slot.horaInicio, minutosPorPartido),
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

      asignados++;
    };

    // ── Helper: check si una pareja excede el límite en un día ──
    const parejaExceedsLimit = (parejaIds: string[], dk: string, limit: number): boolean => {
      for (const pid of parejaIds) {
        const sched = parejaSchedule.get(pid);
        if (sched && (sched.get(dk) || 0) >= limit) return true;
      }
      return false;
    };

    // ── Helper: check budget ──
    const budgetExceeded = (dk: string, multiplier: number = 1): boolean => {
      const budget = dayBudgets.get(dk) || 0;
      const used = dayBudgetUsed.get(dk) || 0;
      return used >= Math.ceil(budget * multiplier);
    };

    // ════════════════════════════════════════
    // FASE B: ASIGNAR FINALES (pool reverso)
    // ════════════════════════════════════════

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

    for (const partido of finalMatches) {
      let assigned = false;
      const esFinal = getRondaOrden(partido.ronda) === 7;

      // FINAL: preferir cancha principal
      if (esFinal && principalCanchaId) {
        for (const slot of finalSlots) {
          if (slot.torneoCanchaId !== principalCanchaId) continue;
          const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
          if (!ocupados.has(key)) {
            await assignSlot(partido, slot);
            assigned = true;
            break;
          }
        }
      }

      // Fallback: pool reverso completo (con budget check)
      if (!assigned) {
        for (const slot of finalSlots) {
          const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
          const dk = dateKey(slot.fecha);
          if (ocupados.has(key)) continue;
          if (budgetExceeded(dk, 1.5)) continue; // Relajado para finales
          await assignSlot(partido, slot);
          assigned = true;
          break;
        }
      }

      // Último recurso: cualquier slot libre
      if (!assigned) {
        for (const slot of finalSlots) {
          const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
          if (!ocupados.has(key)) {
            await assignSlot(partido, slot);
            assigned = true;
            break;
          }
        }
      }

      if (!assigned) sinSlot++;
    }

    // ════════════════════════════════════════
    // FASE C: ASIGNAR REGULARES (distribución)
    // ════════════════════════════════════════

    for (const partido of regularMatches) {
      const ronda = partido.ronda;
      const roundConfig = roundDayMap.get(ronda);
      const parejaIds: string[] = [partido.pareja1Id, partido.pareja2Id].filter(Boolean);
      const earliestDay = roundConfig?.earliestDay || null;

      // Helper: check si un slot cumple las condiciones
      const isValidSlot = (
        slot: typeof allSlots[0],
        dayFilter: Date[] | null,
        budgetMult: number,
        parejaLimit: number,
      ): boolean => {
        const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
        const dk = dateKey(slot.fecha);
        if (ocupados.has(key)) return false;
        if (earliestDay && slot.fecha.getTime() < earliestDay.getTime()) return false;
        if (dayFilter && !dayFilter.some((d) => dateKey(d) === dk)) return false;
        if (budgetExceeded(dk, budgetMult)) return false;
        if (parejaIds.length > 0 && parejaExceedsLimit(parejaIds, dk, parejaLimit)) return false;
        return true;
      };

      let assigned = false;

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

      // Nivel 4: Último recurso — cualquier slot libre (safety net), respetando earliestDay
      if (!assigned) {
        for (const slot of allSlots) {
          const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
          if (ocupados.has(key)) continue;
          if (earliestDay && slot.fecha.getTime() < earliestDay.getTime()) continue;
          await assignSlot(partido, slot);
          assigned = true;
          break;
        }
      }

      if (!assigned) sinSlot++;
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
