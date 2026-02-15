import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateReglaAscensoDto } from './dto/create-regla-ascenso.dto';
import { UpdateReglaAscensoDto } from './dto/update-regla-ascenso.dto';
import { CambiarCategoriaDto } from './dto/cambiar-categoria.dto';
import { FeedService } from '../feed/feed.service';

@Injectable()
export class CategoriasService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private feedService: FeedService,
  ) {}

  // ═══════════════════════════════════════════
  // CRUD REGLAS DE ASCENSO
  // ═══════════════════════════════════════════

  async obtenerReglasAscenso(genero?: string) {
    const where: any = {};
    if (genero) {
      where.categoriaOrigen = { tipo: genero };
    }
    return this.prisma.reglaAscenso.findMany({
      where,
      include: {
        categoriaOrigen: true,
        categoriaDestino: true,
      },
      orderBy: [
        { categoriaOrigen: { tipo: 'asc' } },
        { categoriaOrigen: { orden: 'desc' } },
      ],
    });
  }

  async crearReglaAscenso(dto: CreateReglaAscensoDto) {
    // Validar que las categorías existen
    const origen = await this.prisma.category.findUnique({ where: { id: dto.categoriaOrigenId } });
    const destino = await this.prisma.category.findUnique({ where: { id: dto.categoriaDestinoId } });
    if (!origen || !destino) throw new NotFoundException('Categoría no encontrada');
    if (origen.tipo !== destino.tipo) throw new BadRequestException('Ambas categorías deben ser del mismo género');
    if (destino.orden >= origen.orden) throw new BadRequestException('La categoría destino debe ser superior (menor orden)');

    // Validar que al menos un umbral esté definido
    if (!dto.campeonatosConsecutivos && !dto.campeonatosAlternados) {
      throw new BadRequestException('Debe definir al menos campeonatos consecutivos o alternados');
    }

    try {
      return await this.prisma.reglaAscenso.create({
        data: {
          categoriaOrigenId: dto.categoriaOrigenId,
          categoriaDestinoId: dto.categoriaDestinoId,
          campeonatosConsecutivos: dto.campeonatosConsecutivos || null,
          campeonatosAlternados: dto.campeonatosAlternados || null,
          finalistaCalifica: dto.finalistaCalifica ?? false,
          activa: dto.activa ?? true,
        },
        include: { categoriaOrigen: true, categoriaDestino: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Ya existe una regla para esta transición de categorías');
      }
      throw e;
    }
  }

  async actualizarReglaAscenso(id: string, dto: UpdateReglaAscensoDto) {
    const regla = await this.prisma.reglaAscenso.findUnique({ where: { id } });
    if (!regla) throw new NotFoundException('Regla no encontrada');

    return this.prisma.reglaAscenso.update({
      where: { id },
      data: {
        ...(dto.campeonatosConsecutivos !== undefined && { campeonatosConsecutivos: dto.campeonatosConsecutivos }),
        ...(dto.campeonatosAlternados !== undefined && { campeonatosAlternados: dto.campeonatosAlternados }),
        ...(dto.finalistaCalifica !== undefined && { finalistaCalifica: dto.finalistaCalifica }),
        ...(dto.activa !== undefined && { activa: dto.activa }),
      },
      include: { categoriaOrigen: true, categoriaDestino: true },
    });
  }

  async eliminarReglaAscenso(id: string) {
    const regla = await this.prisma.reglaAscenso.findUnique({ where: { id } });
    if (!regla) throw new NotFoundException('Regla no encontrada');
    await this.prisma.reglaAscenso.delete({ where: { id } });
    return { message: 'Regla eliminada' };
  }

  // ═══════════════════════════════════════════
  // GESTIÓN DE JUGADORES
  // ═══════════════════════════════════════════

  async buscarJugadores(search: string) {
    if (!search || search.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        OR: [
          { documento: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
        ],
      },
      include: { categoriaActual: true },
      take: 20,
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerCategoriaJugador(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { categoriaActual: true },
    });
    if (!user) throw new NotFoundException('Jugador no encontrado');

    const historial = await this.prisma.historialCategoria.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { user, historial };
  }

  async cambiarCategoriaManual(userId: string, dto: CambiarCategoriaDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { categoriaActual: true },
    });
    if (!user) throw new NotFoundException('Jugador no encontrado');

    const nuevaCategoria = await this.prisma.category.findUnique({ where: { id: dto.nuevaCategoriaId } });
    if (!nuevaCategoria) throw new NotFoundException('Categoría no encontrada');

    if (nuevaCategoria.tipo !== user.genero) {
      throw new BadRequestException('La categoría debe corresponder al género del jugador');
    }

    await this.ejecutarPromocion(
      userId,
      dto.nuevaCategoriaId,
      dto.tipo as any,
      dto.motivo,
      null,
      adminId,
    );

    return { message: `Jugador movido a ${nuevaCategoria.nombre}` };
  }

  // ═══════════════════════════════════════════
  // HISTORIAL DE MOVIMIENTOS
  // ═══════════════════════════════════════════

  async obtenerHistorialMovimientos(filtros?: {
    userId?: string;
    tipo?: string;
    desde?: string;
    hasta?: string;
  }) {
    const where: any = {};
    if (filtros?.userId) where.userId = filtros.userId;
    if (filtros?.tipo) where.tipo = filtros.tipo;
    if (filtros?.desde || filtros?.hasta) {
      where.createdAt = {};
      if (filtros.desde) where.createdAt.gte = new Date(filtros.desde);
      if (filtros.hasta) where.createdAt.lte = new Date(filtros.hasta);
    }

    return this.prisma.historialCategoria.findMany({
      where,
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, documento: true, genero: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ═══════════════════════════════════════════
  // LÓGICA DE PROMOCIÓN (usado por MatchesService)
  // ═══════════════════════════════════════════

  /**
   * Verifica y ejecuta promociones para todos los jugadores en los standings.
   * Llamado desde finalizarCategoria() en MatchesService.
   */
  async verificarYEjecutarPromociones(
    standings: Array<{
      posicion: string;
      pareja?: {
        jugador1?: { id: string; nombre: string; apellido: string; categoriaActualId?: string };
        jugador2?: { id: string; nombre: string; apellido: string; categoriaActualId?: string };
      };
    }>,
    categoryId: string,
    tournamentId: string,
  ) {
    const promociones: Array<{
      jugadorId: string;
      jugadorNombre: string;
      categoriaAnterior: string;
      categoriaNueva: string;
      tipo: string;
    }> = [];

    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return promociones;

    for (const entry of standings) {
      if (!entry.pareja) continue;
      const jugadores = [entry.pareja.jugador1, entry.pareja.jugador2].filter(Boolean);

      for (const jugador of jugadores) {
        if (!jugador) continue;

        // Reload user to get fresh categoriaActualId
        const user = await this.prisma.user.findUnique({
          where: { id: jugador.id },
          include: { categoriaActual: true },
        });
        if (!user || !user.categoriaActualId) continue;

        // A) Promoción por demostración
        // El jugador jugó en una categoría SUPERIOR a la suya y fue Campeón/Finalista
        if (user.categoriaActualId !== categoryId) {
          // Verify it's a HIGHER category (lower orden number)
          if (category.orden < user.categoriaActual.orden) {
            const isDemoQualified = await this.verificarDemostracion(
              entry.posicion,
              user.categoriaActualId,
              categoryId,
            );

            if (isDemoQualified) {
              const categoriaAnteriorNombre = user.categoriaActual?.nombre || 'Sin categoría';
              await this.ejecutarPromocion(
                user.id,
                categoryId,
                'ASCENSO_POR_DEMOSTRACION',
                `Ascenso por demostración: ${entry.posicion} en ${category.nombre}`,
                tournamentId,
              );
              promociones.push({
                jugadorId: user.id,
                jugadorNombre: `${user.nombre} ${user.apellido}`,
                categoriaAnterior: categoriaAnteriorNombre,
                categoriaNueva: category.nombre,
                tipo: 'ASCENSO_POR_DEMOSTRACION',
              });
              continue; // Don't double-check rule-based
            }
          }
        }

        // B) Promoción por regla (solo si jugó en SU categoría)
        if (user.categoriaActualId === categoryId) {
          const isChampionOrQualified = await this.esResultadoCalificable(entry.posicion, categoryId);
          if (isChampionOrQualified) {
            const resultado = await this.verificarReglaAscenso(user.id, categoryId);
            if (resultado.promovido && resultado.nuevaCategoria) {
              const categoriaAnteriorNombre = user.categoriaActual?.nombre || 'Sin categoría';
              await this.ejecutarPromocion(
                user.id,
                resultado.nuevaCategoria.id,
                'ASCENSO_AUTOMATICO',
                `Ascenso automático por regla: ${entry.posicion} en ${category.nombre}`,
                tournamentId,
              );
              promociones.push({
                jugadorId: user.id,
                jugadorNombre: `${user.nombre} ${user.apellido}`,
                categoriaAnterior: categoriaAnteriorNombre,
                categoriaNueva: resultado.nuevaCategoria.nombre,
                tipo: 'ASCENSO_AUTOMATICO',
              });
            }
          }
        }
      }
    }

    return promociones;
  }

  /**
   * Verifica si el resultado califica para demostración en la categoría.
   * Campeón siempre califica. Finalista califica si la regla de ascenso
   * desde la categoría actual del jugador tiene finalistaCalifica = true.
   */
  private async verificarDemostracion(
    posicion: string,
    categoriaActualId: string,
    categoryJugadaId: string,
  ): Promise<boolean> {
    if (posicion === 'Campeón') return true;

    if (posicion === 'Finalista') {
      // Check if there's a rule from player's category where finalistaCalifica is true
      const regla = await this.prisma.reglaAscenso.findFirst({
        where: {
          categoriaOrigenId: categoriaActualId,
          activa: true,
          finalistaCalifica: true,
        },
      });
      return !!regla;
    }

    return false;
  }

  /**
   * Verifica si el resultado (Campeón o Finalista si finalistaCalifica)
   * califica para conteo en reglas de ascenso.
   */
  private async esResultadoCalificable(posicion: string, categoryId: string): Promise<boolean> {
    if (posicion === 'Campeón') return true;

    if (posicion === 'Finalista') {
      const regla = await this.prisma.reglaAscenso.findFirst({
        where: {
          categoriaOrigenId: categoryId,
          activa: true,
          finalistaCalifica: true,
        },
      });
      return !!regla;
    }

    return false;
  }

  /**
   * Verifica reglas de ascenso para un jugador en una categoría específica.
   * Cuenta campeonatos consecutivos y totales en HistorialPuntos.
   */
  private async verificarReglaAscenso(userId: string, categoryId: string) {
    const reglas = await this.prisma.reglaAscenso.findMany({
      where: { categoriaOrigenId: categoryId, activa: true },
      include: { categoriaDestino: true },
    });

    if (reglas.length === 0) return { promovido: false };

    for (const regla of reglas) {
      let promover = false;

      // Check consecutive championships
      if (regla.campeonatosConsecutivos) {
        const consecutivos = await this.contarCampeonatosConsecutivos(
          userId,
          categoryId,
          regla.finalistaCalifica,
        );
        if (consecutivos >= regla.campeonatosConsecutivos) promover = true;
      }

      // Check total championships (OR condition)
      if (!promover && regla.campeonatosAlternados) {
        const totales = await this.contarCampeonatosTotales(
          userId,
          categoryId,
          regla.finalistaCalifica,
        );
        if (totales >= regla.campeonatosAlternados) promover = true;
      }

      if (promover) {
        return { promovido: true, nuevaCategoria: regla.categoriaDestino };
      }
    }

    return { promovido: false };
  }

  /**
   * Cuenta campeonatos consecutivos recientes en una categoría.
   * Lee HistorialPuntos ordenado por fecha DESC y cuenta la racha.
   */
  private async contarCampeonatosConsecutivos(
    userId: string,
    categoryId: string,
    finalistaCalifica: boolean,
  ): Promise<number> {
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId, categoryId },
      orderBy: { fechaTorneo: 'desc' },
      select: { posicionFinal: true },
    });

    let count = 0;
    const posicionesCalificables = finalistaCalifica
      ? ['Campeón', 'Finalista']
      : ['Campeón'];

    for (const h of historial) {
      if (posicionesCalificables.includes(h.posicionFinal)) {
        count++;
      } else {
        break; // Streak broken
      }
    }

    return count;
  }

  /**
   * Cuenta total de campeonatos en una categoría (no consecutivos).
   */
  private async contarCampeonatosTotales(
    userId: string,
    categoryId: string,
    finalistaCalifica: boolean,
  ): Promise<number> {
    const posicionesCalificables = finalistaCalifica
      ? ['Campeón', 'Finalista']
      : ['Campeón'];

    return this.prisma.historialPuntos.count({
      where: {
        jugadorId: userId,
        categoryId,
        posicionFinal: { in: posicionesCalificables },
      },
    });
  }

  /**
   * Ejecuta la promoción: actualiza categoría del usuario, crea historial, envía notificación.
   */
  async ejecutarPromocion(
    userId: string,
    nuevaCategoriaId: string,
    tipo: 'ASCENSO_AUTOMATICO' | 'ASCENSO_POR_DEMOSTRACION' | 'ASCENSO_MANUAL' | 'DESCENSO_MANUAL',
    motivo: string,
    tournamentId?: string,
    realizadoPor?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { categoriaActual: true },
    });
    if (!user) return;

    const nuevaCategoria = await this.prisma.category.findUnique({ where: { id: nuevaCategoriaId } });
    if (!nuevaCategoria) return;

    // 1. Update user's current category
    await this.prisma.user.update({
      where: { id: userId },
      data: { categoriaActualId: nuevaCategoriaId },
    });

    // 2. Create history entry
    await this.prisma.historialCategoria.create({
      data: {
        userId,
        categoriaAnteriorId: user.categoriaActualId,
        categoriaNuevaId: nuevaCategoriaId,
        tipo,
        motivo,
        tournamentId: tournamentId || null,
        realizadoPor: realizadoPor || null,
      },
    });

    // 3. Send notification (use specialized method for ascensos, fallback for descensos)
    if (tipo.includes('ASCENSO')) {
      const categoriaAnterior = user.categoriaActual?.nombre || 'Sin categoría';
      await this.notificacionesService.notificarAscensoCategoria(
        userId,
        categoriaAnterior,
        nuevaCategoria.nombre,
      );
    } else {
      await this.notificacionesService.crearNotificacion(
        userId,
        'RANKING',
        `Tu categoría ha sido actualizada a ${nuevaCategoria.nombre}`,
      );
    }

    // Auto-post ascenso to feed
    if (tipo.includes('ASCENSO') && user.esPremium) {
      try {
        const categoriaAnterior = user.categoriaActual?.nombre || 'Sin categoría';
        await this.feedService.crearPublicacionAscenso(
          userId,
          `¡Ascendió de ${categoriaAnterior} a ${nuevaCategoria.nombre}!`,
          nuevaCategoriaId,
          JSON.stringify({ anterior: categoriaAnterior, nueva: nuevaCategoria.nombre, tipo }),
        );
      } catch (e) {
        // Non-critical, don't fail promotion
      }
    }
  }
}
