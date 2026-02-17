import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { FeedService } from '../feed/feed.service';

@Injectable()
export class LogrosService {
  private readonly logger = new Logger(LogrosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly feedService: FeedService,
  ) {}

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  /**
   * Get all logros (public)
   */
  async getAll() {
    return this.prisma.logro.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  /**
   * Get logros for current user with unlock status
   */
  async getMisLogros(userId: string) {
    const [logros, desbloqueados] = await Promise.all([
      this.prisma.logro.findMany({ orderBy: { orden: 'asc' } }),
      this.prisma.usuarioLogro.findMany({
        where: { userId },
        select: { logroId: true, fechaDesbloqueo: true },
      }),
    ]);

    const desbloqueadosMap = new Map(
      desbloqueados.map((d) => [d.logroId, d.fechaDesbloqueo]),
    );

    return logros.map((logro) => ({
      ...logro,
      desbloqueado: desbloqueadosMap.has(logro.id),
      fechaDesbloqueo: desbloqueadosMap.get(logro.id) || null,
    }));
  }

  /**
   * Get unlocked logros for a user (public view)
   */
  async getLogrosPublicos(userId: string) {
    const desbloqueados = await this.prisma.usuarioLogro.findMany({
      where: { userId },
      include: { logro: true },
      orderBy: { logro: { orden: 'asc' } },
    });

    return desbloqueados.map((ul) => ({
      ...ul.logro,
      desbloqueado: true,
      fechaDesbloqueo: ul.fechaDesbloqueo,
    }));
  }

  // ═══════════════════════════════════════
  // BADGE DETECTION ENGINE
  // ═══════════════════════════════════════

  /**
   * Evaluate all badges for a user. Called after key events.
   * Safe to call multiple times — already-unlocked badges are skipped.
   */
  async verificarLogros(userId: string): Promise<void> {
    try {
      // Get user with premium status
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, esPremium: true, nombre: true, apellido: true },
      });

      if (!user) return;

      // Get already unlocked logros for this user
      const yaDesbloqueados = await this.prisma.usuarioLogro.findMany({
        where: { userId },
        select: { logroId: true },
      });
      const desbloqueadosIds = new Set(yaDesbloqueados.map((d) => d.logroId));

      // Get all logros
      const todosLogros = await this.prisma.logro.findMany();

      // Run each check
      for (const logro of todosLogros) {
        // Skip if already unlocked
        if (desbloqueadosIds.has(logro.id)) continue;

        // Skip premium-only logros for free users
        if (logro.requierePremium && !user.esPremium) continue;

        const cumple = await this.evaluarCondicion(userId, logro.condicion);

        if (cumple) {
          await this.desbloquearLogro(userId, logro, user.nombre, user.apellido);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error verificando logros para usuario ${userId}: ${error.message}`,
      );
    }
  }

  // ═══════════════════════════════════════
  // CONDITION EVALUATOR
  // ═══════════════════════════════════════

  private async evaluarCondicion(
    userId: string,
    condicion: string,
  ): Promise<boolean> {
    try {
      // Parse condition string: "field operator value"
      // Examples: "victorias >= 1", "racha_actual >= 5", "posicion_ranking <= 10"

      if (condicion === 'campeonato_sin_perder_set') {
        return this.checkInvicto(userId);
      }

      const match = condicion.match(
        /^(\w+)\s*(>=|<=|==|>|<)\s*(\d+)$/,
      );

      if (!match) {
        this.logger.warn(`Condición no reconocida: ${condicion}`);
        return false;
      }

      const [, field, operator, valueStr] = match;
      const targetValue = parseInt(valueStr, 10);

      const actualValue = await this.getFieldValue(userId, field);

      switch (operator) {
        case '>=':
          return actualValue >= targetValue;
        case '<=':
          return actualValue > 0 && actualValue <= targetValue;
        case '==':
          return actualValue === targetValue;
        case '>':
          return actualValue > targetValue;
        case '<':
          return actualValue > 0 && actualValue < targetValue;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(
        `Error evaluando condición "${condicion}": ${error.message}`,
      );
      return false;
    }
  }

  private async getFieldValue(
    userId: string,
    field: string,
  ): Promise<number> {
    switch (field) {
      case 'inscripciones_confirmadas':
        return this.countInscripcionesConfirmadas(userId);
      case 'victorias':
        return this.countVictorias(userId);
      case 'campeonatos':
        return this.countCampeonatos(userId);
      case 'racha_actual':
        return this.getRachaActual(userId);
      case 'posicion_ranking':
        return this.getPosicionRanking(userId);
      case 'ascensos':
        return this.countAscensos(userId);
      case 'torneos_distintos':
        return this.countTorneosDistintos(userId);
      case 'seguidores':
        return this.countSeguidores(userId);
      default:
        this.logger.warn(`Campo desconocido: ${field}`);
        return 0;
    }
  }

  // ═══════════════════════════════════════
  // DATA QUERIES
  // ═══════════════════════════════════════

  private async countInscripcionesConfirmadas(userId: string): Promise<number> {
    return this.prisma.inscripcion.count({
      where: {
        estado: 'CONFIRMADA',
        pareja: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
    });
  }

  private async countVictorias(userId: string): Promise<number> {
    return this.prisma.match.count({
      where: {
        estado: 'FINALIZADO',
        parejaGanadora: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
    });
  }

  private async countCampeonatos(userId: string): Promise<number> {
    return this.prisma.match.count({
      where: {
        estado: 'FINALIZADO',
        ronda: 'FINAL',
        parejaGanadora: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
    });
  }

  private async getRachaActual(userId: string): Promise<number> {
    // Get best racha across all ranking entries
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId: userId },
      select: { rachaActual: true },
      orderBy: { rachaActual: 'desc' },
      take: 1,
    });

    return rankings[0]?.rachaActual || 0;
  }

  private async getPosicionRanking(userId: string): Promise<number> {
    // Get best position across all ranking types
    const ranking = await this.prisma.ranking.findFirst({
      where: {
        jugadorId: userId,
        posicion: { gt: 0 },
      },
      orderBy: { posicion: 'asc' },
      select: { posicion: true },
    });

    return ranking?.posicion || 0;
  }

  private async countAscensos(userId: string): Promise<number> {
    return this.prisma.historialCategoria.count({
      where: {
        userId,
        tipo: {
          in: [
            'ASCENSO_AUTOMATICO',
            'ASCENSO_POR_DEMOSTRACION',
            'ASCENSO_MANUAL',
          ],
        },
      },
    });
  }

  private async countTorneosDistintos(userId: string): Promise<number> {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        estado: 'CONFIRMADA',
        pareja: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
      select: { tournamentId: true },
      distinct: ['tournamentId'],
    });

    return inscripciones.length;
  }

  private async countSeguidores(userId: string): Promise<number> {
    return this.prisma.seguimiento.count({
      where: { seguidoId: userId },
    });
  }

  /**
   * Check if user won their last tournament without losing a single set
   */
  private async checkInvicto(userId: string): Promise<boolean> {
    // Find last FINAL won by this user
    const lastFinalWon = await this.prisma.match.findFirst({
      where: {
        ronda: 'FINAL',
        estado: 'FINALIZADO',
        parejaGanadora: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        tournamentId: true,
        categoryId: true,
        parejaGanadoraId: true,
      },
    });

    if (!lastFinalWon) return false;

    // Get all matches from that tournament+category for the winning pair
    const allMatches = await this.prisma.match.findMany({
      where: {
        tournamentId: lastFinalWon.tournamentId,
        categoryId: lastFinalWon.categoryId,
        estado: 'FINALIZADO',
        OR: [
          { pareja1Id: lastFinalWon.parejaGanadoraId },
          { pareja2Id: lastFinalWon.parejaGanadoraId },
        ],
      },
      select: {
        pareja1Id: true,
        pareja2Id: true,
        parejaGanadoraId: true,
        set1Pareja1: true,
        set1Pareja2: true,
        set2Pareja1: true,
        set2Pareja2: true,
        set3Pareja1: true,
        set3Pareja2: true,
      },
    });

    // Check if the winning pair lost any set
    for (const m of allMatches) {
      const isPareja1 = m.pareja1Id === lastFinalWon.parejaGanadoraId;

      // Check each set
      const sets = [
        { ours: isPareja1 ? m.set1Pareja1 : m.set1Pareja2, theirs: isPareja1 ? m.set1Pareja2 : m.set1Pareja1 },
        { ours: isPareja1 ? m.set2Pareja1 : m.set2Pareja2, theirs: isPareja1 ? m.set2Pareja2 : m.set2Pareja1 },
        { ours: isPareja1 ? m.set3Pareja1 : m.set3Pareja2, theirs: isPareja1 ? m.set3Pareja2 : m.set3Pareja1 },
      ];

      for (const set of sets) {
        if (set.ours !== null && set.theirs !== null) {
          if (set.theirs > set.ours) {
            return false; // Lost a set
          }
        }
      }
    }

    return true;
  }

  // ═══════════════════════════════════════
  // UNLOCK LOGIC
  // ═══════════════════════════════════════

  private async desbloquearLogro(
    userId: string,
    logro: { id: string; nombre: string; descripcion: string; icono: string },
    nombreUsuario: string,
    apellidoUsuario: string,
  ): Promise<void> {
    try {
      // Create the unlock record (upsert to be safe)
      await this.prisma.usuarioLogro.create({
        data: {
          userId,
          logroId: logro.id,
        },
      });

      this.logger.log(
        `Logro desbloqueado: "${logro.nombre}" para ${nombreUsuario} ${apellidoUsuario}`,
      );

      // Send notification
      await this.notificacionesService.crearNotificacion(
        userId,
        'SISTEMA',
        `Desbloqueaste el logro "${logro.nombre}": ${logro.descripcion}`,
        true, // enviarEmail
        false, // no SMS for badges
      );

      // Auto-post to feed
      await this.feedService.crearPublicacionLogro(
        userId,
        `Desbloqueó el logro "${logro.nombre}" 🏅`,
        JSON.stringify({
          logroId: logro.id,
          logroNombre: logro.nombre,
          logroIcono: logro.icono,
        }),
      );
    } catch (error) {
      // Unique constraint violation = already unlocked, ignore
      if (error.code === 'P2002') {
        return;
      }
      this.logger.error(
        `Error desbloqueando logro "${logro.nombre}" para ${userId}: ${error.message}`,
      );
    }
  }
}
