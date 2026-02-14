import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EstadisticasJugador {
  efectividad: number;
  consistencia: number;
  potenciaOfensiva: number;
  solidezDefensiva: number;
  clutch: number;
  regularidad: number;
  overall: number;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async obtenerPerfilPublico(id: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        genero: true,
        ciudad: true,
        bio: true,
        fotoUrl: true,
        esPremium: true,
        createdAt: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async actualizarPerfil(id: string, data: any) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const datosPermitidos = {
      nombre: data.nombre,
      apellido: data.apellido,
      ciudad: data.ciudad,
      bio: data.bio,
      fotoUrl: data.fotoUrl,
    };

    const usuarioActualizado = await this.prisma.user.update({
      where: { id },
      data: datosPermitidos,
    });

    return usuarioActualizado;
  }

  async buscarPorDocumento(documento: string) {
    return this.prisma.user.findUnique({
      where: { documento },
    });
  }

  async buscarPorEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // ═══════════════════════════════════════════════════════
  // PERFIL COMPLETO — Endpoint agregado para el perfil
  // ═══════════════════════════════════════════════════════

  async obtenerPerfilCompleto(userId: string, viewerId: string | null) {
    // 1. User info
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        genero: true,
        ciudad: true,
        bio: true,
        fotoUrl: true,
        esPremium: true,
        createdAt: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Ranking global
    const ranking = await this.prisma.ranking.findFirst({
      where: { jugadorId: userId, tipoRanking: 'GLOBAL', alcance: 'GLOBAL' },
    });

    // 3. Stats
    const estadisticas = await this.calcularEstadisticasJugador(userId);

    // 4. Recent matches
    const partidosRecientes = await this.obtenerPartidosRecientes(userId, 10);

    // 5. Tournament history
    const historialTorneos = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      include: {
        tournament: { select: { id: true, nombre: true, ciudad: true, fechaInicio: true } },
        category: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
      take: 20,
    });

    // 6. Social counts
    const [seguidoresCount, siguiendoCount] = await Promise.all([
      this.prisma.seguimiento.count({ where: { seguidoId: userId } }),
      this.prisma.seguimiento.count({ where: { seguidorId: userId } }),
    ]);

    let isFollowing = false;
    if (viewerId && viewerId !== userId) {
      const follow = await this.prisma.seguimiento.findFirst({
        where: { seguidorId: viewerId, seguidoId: userId },
      });
      isFollowing = !!follow;
    }

    // 7. Photos (approved)
    const fotos = await this.prisma.foto.findMany({
      where: { userId, estadoModeracion: 'APROBADA' },
      select: {
        id: true,
        urlImagen: true,
        urlThumbnail: true,
        descripcion: true,
        likesCount: true,
        comentariosCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    return {
      usuario,
      ranking,
      estadisticas,
      partidosRecientes,
      historialTorneos,
      social: {
        seguidores: seguidoresCount,
        siguiendo: siguiendoCount,
        isFollowing,
        isOwnProfile: viewerId === userId,
      },
      fotos,
    };
  }

  // ═══════════════════════════════════════════════════════
  // STATS ENGINE — Calcula 6 stats + overall
  // ═══════════════════════════════════════════════════════

  async calcularEstadisticasJugador(userId: string): Promise<EstadisticasJugador> {
    // Find all parejas for this player
    const parejas = await this.prisma.pareja.findMany({
      where: {
        OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
      },
      select: { id: true },
    });

    const parejaIds = parejas.map((p) => p.id);

    if (parejaIds.length === 0) {
      return this.emptyStats();
    }

    // Get all finished matches for these parejas
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { pareja1Id: { in: parejaIds } },
          { pareja2Id: { in: parejaIds } },
        ],
        estado: { in: ['FINALIZADO', 'WO'] },
      },
      select: {
        id: true,
        pareja1Id: true,
        pareja2Id: true,
        parejaGanadoraId: true,
        set1Pareja1: true,
        set1Pareja2: true,
        set2Pareja1: true,
        set2Pareja2: true,
        set3Pareja1: true,
        set3Pareja2: true,
        ronda: true,
        estado: true,
        updatedAt: true,
      },
    });

    if (matches.length === 0) {
      return this.emptyStats();
    }

    // Classify matches
    const parejaIdSet = new Set(parejaIds);
    let wins = 0;
    let losses = 0;
    let totalGamesWon = 0;
    let totalGamesConceded = 0;
    let setsPlayed = 0;
    let threeSetMatches = 0;
    let threeSetWins = 0;
    let semiFinalsPlayed = 0;
    let semiFinalsWon = 0;

    for (const m of matches) {
      const myParejaId = parejaIdSet.has(m.pareja1Id) ? m.pareja1Id : m.pareja2Id;
      const isP1 = myParejaId === m.pareja1Id;
      const won = m.parejaGanadoraId === myParejaId;

      if (won) wins++;
      else losses++;

      // Set scores (skip WO matches for game stats)
      if (m.estado === 'FINALIZADO' && m.set1Pareja1 != null) {
        // Set 1
        const s1Won = isP1 ? m.set1Pareja1 : m.set1Pareja2;
        const s1Lost = isP1 ? m.set1Pareja2 : m.set1Pareja1;
        if (s1Won != null && s1Lost != null) {
          totalGamesWon += s1Won;
          totalGamesConceded += s1Lost;
          setsPlayed++;
        }

        // Set 2
        const s2Won = isP1 ? m.set2Pareja1 : m.set2Pareja2;
        const s2Lost = isP1 ? m.set2Pareja2 : m.set2Pareja1;
        if (s2Won != null && s2Lost != null) {
          totalGamesWon += s2Won;
          totalGamesConceded += s2Lost;
          setsPlayed++;
        }

        // Set 3
        const s3Won = isP1 ? m.set3Pareja1 : m.set3Pareja2;
        const s3Lost = isP1 ? m.set3Pareja2 : m.set3Pareja1;
        if (s3Won != null && s3Lost != null) {
          totalGamesWon += s3Won;
          totalGamesConceded += s3Lost;
          setsPlayed++;
          threeSetMatches++;
          if (won) threeSetWins++;
        }
      }

      // Semi/Final performance
      if (['SEMIFINAL', 'FINAL'].includes(m.ronda)) {
        semiFinalsPlayed++;
        if (won) semiFinalsWon++;
      }
    }

    const totalMatches = wins + losses;

    // 1. Efectividad (Win Rate)
    let efectividad = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
    if (totalMatches < 5 && efectividad > 80) efectividad = 80;

    // 2. Consistencia (weighted tournament positions)
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      orderBy: { fechaTorneo: 'desc' },
      take: 10,
    });

    const posicionPesos: Record<string, number> = {
      'Campeón': 100, 'CAMPEON': 100,
      'Finalista': 80, 'FINALISTA': 80,
      'Semifinalista': 60, 'SEMIFINALISTA': 60,
      'Cuartos de Final': 40, 'CUARTOS': 40,
      'Octavos de Final': 20, 'OCTAVOS': 20,
      'Primera Ronda': 10, 'PRIMERA_RONDA': 10,
    };

    let consistencia = 0;
    if (historial.length > 0) {
      const sum = historial.reduce((acc, h) => acc + (posicionPesos[h.posicionFinal] || 10), 0);
      consistencia = sum / historial.length;
    }

    // 3. Potencia Ofensiva (avg games won per set / 7 * 100)
    let potenciaOfensiva = 0;
    if (setsPlayed > 0) {
      const avgWon = totalGamesWon / setsPlayed;
      potenciaOfensiva = Math.min((avgWon / 7) * 100, 100);
    }

    // 4. Solidez Defensiva (1 - avg games conceded per set / 7) * 100
    let solidezDefensiva = 0;
    if (setsPlayed > 0) {
      const avgConceded = totalGamesConceded / setsPlayed;
      solidezDefensiva = Math.max((1 - avgConceded / 7) * 100, 0);
    }

    // 5. Clutch / Mentalidad
    let clutch = 0;
    const threeSetWinRate = threeSetMatches > 0 ? (threeSetWins / threeSetMatches) * 100 : efectividad * 0.7;
    const semiFinalsWinRate = semiFinalsPlayed > 0 ? (semiFinalsWon / semiFinalsPlayed) * 100 : efectividad * 0.7;
    clutch = threeSetWinRate * 0.6 + semiFinalsWinRate * 0.4;

    // 6. Regularidad (activity + consistency)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentTournaments = historial.filter(
      (h) => new Date(h.fechaTorneo) >= sixMonthsAgo,
    ).length;

    const activityScore = Math.min(recentTournaments / 4, 1) * 100;

    // Standard deviation of tournament results
    let resultStdDev = 0;
    if (historial.length >= 3) {
      const scores = historial.map((h) => posicionPesos[h.posicionFinal] || 10);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
      resultStdDev = Math.sqrt(variance);
    }
    const consistencyScore = Math.max(100 - resultStdDev * 2, 0);

    let regularidad = activityScore * 0.5 + consistencyScore * 0.5;
    if (historial.length < 3) regularidad = Math.min(regularidad, 50);

    // Overall
    const overall = Math.round(
      efectividad * 0.25 +
      consistencia * 0.20 +
      potenciaOfensiva * 0.15 +
      solidezDefensiva * 0.15 +
      clutch * 0.15 +
      regularidad * 0.10,
    );

    return {
      efectividad: Math.round(efectividad),
      consistencia: Math.round(consistencia),
      potenciaOfensiva: Math.round(potenciaOfensiva),
      solidezDefensiva: Math.round(solidezDefensiva),
      clutch: Math.round(clutch),
      regularidad: Math.round(regularidad),
      overall,
    };
  }

  private emptyStats(): EstadisticasJugador {
    return {
      efectividad: 0,
      consistencia: 0,
      potenciaOfensiva: 0,
      solidezDefensiva: 0,
      clutch: 0,
      regularidad: 0,
      overall: 0,
    };
  }

  // ═══════════════════════════════════════════════════════
  // PARTIDOS RECIENTES — Últimos N matches del jugador
  // ═══════════════════════════════════════════════════════

  async obtenerPartidosRecientes(userId: string, limit = 10) {
    // Get all pareja IDs
    const parejas = await this.prisma.pareja.findMany({
      where: { OR: [{ jugador1Id: userId }, { jugador2Id: userId }] },
      select: { id: true },
    });
    const parejaIds = parejas.map((p) => p.id);

    if (parejaIds.length === 0) return [];

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { pareja1Id: { in: parejaIds } },
          { pareja2Id: { in: parejaIds } },
        ],
        estado: { in: ['FINALIZADO', 'WO'] },
      },
      include: {
        tournament: { select: { id: true, nombre: true } },
        category: { select: { id: true, nombre: true } },
        pareja1: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        pareja2: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const parejaIdSet = new Set(parejaIds);

    return matches.map((m) => {
      const isP1 = parejaIdSet.has(m.pareja1Id);
      const myPareja = isP1 ? m.pareja1 : m.pareja2;
      const opPareja = isP1 ? m.pareja2 : m.pareja1;
      const victoria = m.parejaGanadoraId && parejaIdSet.has(m.parejaGanadoraId);

      // Determine partner (the other player in my pareja)
      let companero = null;
      if (myPareja) {
        const isJ1 = myPareja.jugador1?.id === userId;
        companero = isJ1 ? myPareja.jugador2 : myPareja.jugador1;
      }

      // Format set scores
      const formatSet = (p1: number | null, p2: number | null) => {
        if (p1 == null || p2 == null) return null;
        return isP1 ? `${p1}-${p2}` : `${p2}-${p1}`;
      };

      return {
        id: m.id,
        fecha: m.updatedAt,
        torneo: m.tournament,
        categoria: m.category,
        ronda: m.ronda,
        resultado: {
          set1: formatSet(m.set1Pareja1, m.set1Pareja2),
          set2: formatSet(m.set2Pareja1, m.set2Pareja2),
          set3: formatSet(m.set3Pareja1, m.set3Pareja2),
        },
        companero,
        oponentes: opPareja ? {
          jugador1: opPareja.jugador1,
          jugador2: opPareja.jugador2,
        } : null,
        victoria: !!victoria,
        esWO: m.estado === 'WO',
      };
    });
  }
}
