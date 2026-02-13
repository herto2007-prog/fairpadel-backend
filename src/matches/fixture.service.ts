import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularHoraFin,
  generarTimeSlots,
  slotKey,
  getRondaOrden,
} from './scheduling-utils';

@Injectable()
export class FixtureService {
  constructor(private prisma: PrismaService) {}

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

    return {
      message: 'Fixture publicado exitosamente',
      tournamentId,
      categoryId,
    };
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
  // GENERACIÓN DE FIXTURE POR CATEGORÍA (con seeding + linking)
  // ═══════════════════════════════════════════════════════

  async generarFixturePorCategoria(
    tournamentId: string,
    categoryId: string,
    inscripciones: any[],
    torneoCanchas: any[],
    minutosPorPartido: number = 60,
  ) {
    const numParejas = inscripciones.length;

    if (numParejas === 0) {
      return null;
    }

    // === SEEDING ===
    const seededData = await this.obtenerSeedingParaCategoria(tournamentId, categoryId);

    const numRondas = Math.ceil(Math.log2(numParejas));
    const bracketSize = Math.pow(2, numRondas);

    // Separar parejas con ranking y sin ranking
    const rankedPairs = seededData.filter((sp) => sp.pairStrength > 0);
    const unrankedPairs = seededData.filter((sp) => sp.pairStrength === 0);

    // Obtener posiciones de seeding para el bracket
    const seedPositions = this.getSeedPositions(bracketSize);

    // Colocar parejas con ranking en sus posiciones de seed
    const bracketSlots: (any | null)[] = new Array(bracketSize).fill(null);

    for (let i = 0; i < rankedPairs.length && i < bracketSize; i++) {
      const position = seedPositions[i];
      if (position >= 0 && position < bracketSize) {
        bracketSlots[position] = rankedPairs[i].pareja;
      }
    }

    // Posiciones vacías para parejas sin ranking
    const emptyPositions = bracketSlots
      .map((slot, idx) => (slot === null ? idx : -1))
      .filter((idx) => idx !== -1);

    // Shuffle parejas sin ranking y colocarlas aleatoriamente
    const shuffledUnranked = this.shuffleArray([...unrankedPairs.map((sp) => sp.pareja)]);

    for (let i = 0; i < shuffledUnranked.length && emptyPositions.length > 0; i++) {
      const randomIdx = Math.floor(Math.random() * emptyPositions.length);
      bracketSlots[emptyPositions[randomIdx]] = shuffledUnranked[i];
      emptyPositions.splice(randomIdx, 1);
    }

    // === GENERAR MATCHES POR RONDA ===
    const matchesByRound: Array<Array<{ pareja1: any; pareja2: any; matchIndex: number }>> = [];

    // Primera ronda: bracketSize/2 matches
    const firstRoundMatches: Array<{ pareja1: any; pareja2: any; matchIndex: number }> = [];
    for (let i = 0; i < bracketSize / 2; i++) {
      firstRoundMatches.push({
        pareja1: bracketSlots[i * 2],
        pareja2: bracketSlots[i * 2 + 1],
        matchIndex: i,
      });
    }
    matchesByRound.push(firstRoundMatches);

    // Rondas siguientes
    for (let r = numRondas - 1; r >= 1; r--) {
      const numMatches = Math.pow(2, r - 1);
      const roundMatches: Array<{ pareja1: any; pareja2: any; matchIndex: number }> = [];
      for (let i = 0; i < numMatches; i++) {
        roundMatches.push({ pareja1: null, pareja2: null, matchIndex: i });
      }
      matchesByRound.push(roundMatches);
    }

    // Crear Match records en DB, ronda por ronda
    const createdMatchesByRound: Array<Array<any>> = [];
    let globalMatchNumber = 1;

    for (let roundIdx = 0; roundIdx < matchesByRound.length; roundIdx++) {
      const roundName = this.getNombreRonda(numRondas - roundIdx);
      const roundMatches = matchesByRound[roundIdx];
      const createdMatches: any[] = [];

      for (const m of roundMatches) {
        const match = await this.prisma.match.create({
          data: {
            tournamentId,
            categoryId,
            ronda: roundName,
            numeroRonda: globalMatchNumber,
            pareja1Id: m.pareja1?.id || null,
            pareja2Id: m.pareja2?.id || null,
            estado: 'PROGRAMADO',
          },
        });
        createdMatches.push({ ...match, matchIndex: m.matchIndex });
        globalMatchNumber++;
      }
      createdMatchesByRound.push(createdMatches);
    }

    // === ENLAZAR MATCHES: partidoSiguienteId + posicionEnSiguiente ===
    for (let roundIdx = 0; roundIdx < createdMatchesByRound.length - 1; roundIdx++) {
      const currentRound = createdMatchesByRound[roundIdx];
      const nextRound = createdMatchesByRound[roundIdx + 1];

      for (const match of currentRound) {
        // Match en posición i → siguiente match en posición floor(i/2)
        const nextMatchIndex = Math.floor(match.matchIndex / 2);
        const nextMatch = nextRound.find((m) => m.matchIndex === nextMatchIndex);

        if (nextMatch) {
          // posición par → slot 1 (pareja1), impar → slot 2 (pareja2)
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

    // === MANEJO DE BYEs ===
    for (const match of createdMatchesByRound[0]) {
      const hasP1 = match.pareja1Id !== null;
      const hasP2 = match.pareja2Id !== null;

      if (hasP1 && !hasP2) {
        await this.autoAdvanceBye(match.id, match.pareja1Id);
      } else if (!hasP1 && hasP2) {
        await this.autoAdvanceBye(match.id, match.pareja2Id);
      }
      // Si ambos son null (slot vacío completo), el match queda como está
    }

    // Recoger todos los partidos creados (flat)
    const allMatches = createdMatchesByRound.flat();

    // === ASIGNAR CANCHAS Y HORARIOS (con detección cross-categoría) ===
    if (torneoCanchas.length > 0) {
      await this.asignarCanchasYHorarios(
        allMatches,
        torneoCanchas,
        tournamentId,
        minutosPorPartido,
      );
    }

    return {
      categoryId,
      numParejas,
      rondas: matchesByRound.map((r, i) => ({
        nombre: this.getNombreRonda(numRondas - i),
        numPartidos: r.length,
      })),
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
  // OBTENER FIXTURE
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
