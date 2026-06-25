import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { PushService } from '../../push/push.service';

@Injectable()
export class SeguimientoService {
  private readonly logger = new Logger(SeguimientoService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  /**
   * Seguir a un usuario
   * @param seguidorId - ID del usuario que sigue
   * @param seguidoId - ID del usuario a seguir
   */
  async seguirUsuario(seguidorId: string, seguidoId: string) {
    // Validar que no se intente seguir a sí mismo
    if (seguidorId === seguidoId) {
      return {
        success: false,
        message: 'No puedes seguirte a ti mismo',
      };
    }

    // Verificar que el usuario a seguir existe y está activo
    const usuarioSeguido = await this.prisma.user.findFirst({
      where: {
        id: seguidoId,
        estado: { in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO] },
      },
    });

    if (!usuarioSeguido) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si ya sigue al usuario
    const existente = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    if (existente) {
      return {
        success: false,
        message: 'Ya sigues a este usuario',
      };
    }

    // Crear el seguimiento
    await this.prisma.seguimiento.create({
      data: {
        seguidorId,
        seguidoId,
      },
    });

    this.logger.log(`Usuario ${seguidorId} ahora sigue a ${seguidoId}`);

    // Avisar al seguido (in-app + push)
    const seguidor = await this.prisma.user.findUnique({
      where: { id: seguidorId },
      select: { nombre: true, apellido: true },
    });
    const nombreSeguidor = seguidor ? `${seguidor.nombre} ${seguidor.apellido}`.trim() : 'Alguien';
    await this.pushService.notificar(seguidoId, {
      tipo: 'SOCIAL',
      titulo: 'Tenés un nuevo seguidor 🎾',
      contenido: `${nombreSeguidor} empezó a seguirte.`,
      enlace: `/jugador/${seguidorId}`,
    });

    // Obtener conteos actualizados
    const counts = await this.getConteosSeguimiento(seguidoId, seguidorId);

    return {
      success: true,
      message: 'Ahora sigues a este usuario',
      data: {
        siguiendo: true,
        seguidoresCount: counts.seguidoresSeguido,
        siguiendoCount: counts.siguiendoSeguidor,
      },
    };
  }

  /**
   * Dejar de seguir a un usuario
   * @param seguidorId - ID del usuario que deja de seguir
   * @param seguidoId - ID del usuario a dejar de seguir
   */
  async dejarDeSeguir(seguidorId: string, seguidoId: string) {
    // Verificar que existe el seguimiento
    const seguimiento = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    if (!seguimiento) {
      return {
        success: false,
        message: 'No sigues a este usuario',
      };
    }

    // Eliminar el seguimiento
    await this.prisma.seguimiento.delete({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    this.logger.log(`Usuario ${seguidorId} dejó de seguir a ${seguidoId}`);

    // Obtener conteos actualizados
    const counts = await this.getConteosSeguimiento(seguidoId, seguidorId);

    return {
      success: true,
      message: 'Has dejado de seguir a este usuario',
      data: {
        siguiendo: false,
        seguidoresCount: counts.seguidoresSeguido,
        siguiendoCount: counts.siguiendoSeguidor,
      },
    };
  }

  /**
   * Eliminar a un seguidor propio ("quitar de mis seguidores").
   * Distinto a dejar de seguir: acá borro el seguimiento donde OTRO me sigue a MÍ.
   * @param miId - ID del usuario autenticado (el seguido)
   * @param seguidorId - ID del seguidor a eliminar
   */
  async eliminarSeguidor(miId: string, seguidorId: string) {
    const seguimiento = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId: miId,
        },
      },
    });

    if (!seguimiento) {
      return {
        success: false,
        message: 'Este usuario no te sigue',
      };
    }

    await this.prisma.seguimiento.delete({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId: miId,
        },
      },
    });

    this.logger.log(`Usuario ${miId} eliminó al seguidor ${seguidorId}`);

    const seguidoresCount = await this.prisma.seguimiento.count({
      where: { seguidoId: miId },
    });

    return {
      success: true,
      message: 'Seguidor eliminado',
      data: { seguidoresCount },
    };
  }

  /**
   * Verificar si el usuario autenticado sigue a otro usuario
   * @param seguidorId - ID del posible seguidor (puede ser null si no está autenticado)
   * @param seguidoId - ID del usuario a verificar
   */
  async checkSiguiendo(seguidorId: string | null, seguidoId: string) {
    if (!seguidorId) {
      return { siguiendo: false };
    }

    const seguimiento = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    return { siguiendo: !!seguimiento };
  }

  /**
   * Obtener conteos de seguidores y siguiendo
   * @param seguidoId - ID del usuario del que se cuentan los seguidores
   * @param seguidorId - ID del usuario del que se cuenta a quién sigue
   */
  private async getConteosSeguimiento(seguidoId: string, seguidorId: string) {
    const [seguidoresSeguido, siguiendoSeguidor] = await Promise.all([
      this.prisma.seguimiento.count({
        where: { seguidoId },
      }),
      this.prisma.seguimiento.count({
        where: { seguidorId },
      }),
    ]);

    return { seguidoresSeguido, siguiendoSeguidor };
  }

  /**
   * Obtener lista de seguidores de un usuario
   * @param usuarioId - ID del usuario
   * @param page - Página para paginación
   * @param limit - Límite de resultados
   */
  async getSeguidores(usuarioId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [seguidores, total] = await Promise.all([
      this.prisma.seguimiento.findMany({
        where: { seguidoId: usuarioId },
        include: {
          seguidor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              fotoUrl: true,
              ciudad: true,
              categoriaActual: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.seguimiento.count({
        where: { seguidoId: usuarioId },
      }),
    ]);

    return {
      data: seguidores.map((s) => s.seguidor),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener lista de usuarios que sigue un usuario
   * @param usuarioId - ID del usuario
   * @param page - Página para paginación
   * @param limit - Límite de resultados
   */
  async getSiguiendo(usuarioId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [siguiendo, total] = await Promise.all([
      this.prisma.seguimiento.findMany({
        where: { seguidorId: usuarioId },
        include: {
          seguido: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              fotoUrl: true,
              ciudad: true,
              categoriaActual: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.seguimiento.count({
        where: { seguidorId: usuarioId },
      }),
    ]);

    return {
      data: siguiendo.map((s) => s.seguido),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Relación entre el usuario autenticado y otro: si yo lo sigo y si él me sigue
   * (para el chip "Te sigue" / "Se siguen" en la ficha).
   */
  async relacion(miId: string, otroId: string) {
    if (!miId || miId === otroId) return { siguiendo: false, teSigue: false };
    const [yo, el] = await Promise.all([
      this.prisma.seguimiento.findUnique({
        where: { seguidorId_seguidoId: { seguidorId: miId, seguidoId: otroId } },
      }),
      this.prisma.seguimiento.findUnique({
        where: { seguidorId_seguidoId: { seguidorId: otroId, seguidoId: miId } },
      }),
    ]);
    return { siguiendo: !!yo, teSigue: !!el };
  }

  /**
   * "Seguido por X, Y…": jugadores que YO sigo y que además siguen a :otroId.
   * Prueba social en la ficha. Devuelve una muestra + total.
   */
  async seguidoresEnComun(miId: string, otroId: string) {
    if (!miId || miId === otroId) return { total: 0, muestra: [] };
    const yoSigo = await this.prisma.seguimiento.findMany({
      where: { seguidorId: miId },
      select: { seguidoId: true },
    });
    const yoSigoIds = yoSigo.map((s) => s.seguidoId).filter((x) => x !== otroId);
    if (yoSigoIds.length === 0) return { total: 0, muestra: [] };

    const comunes = await this.prisma.seguimiento.findMany({
      where: { seguidoId: otroId, seguidorId: { in: yoSigoIds } },
      select: {
        seguidor: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
      take: 50,
    });
    return {
      total: comunes.length,
      muestra: comunes.slice(0, 3).map((c) => c.seguidor),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // "Seguir una pareja" en un torneo (para alentarla / ver su camino en el
  // cuadro). Es OTRA cosa que la conexión social: usa la tabla SeguimientoPareja,
  // NO toca Seguimiento. La unidad es la inscripción (la pareja).
  // ─────────────────────────────────────────────────────────────

  async seguirPareja(userId: string, inscripcionId: string) {
    await this.prisma.seguimientoPareja.upsert({
      where: { userId_inscripcionId: { userId, inscripcionId } },
      create: { userId, inscripcionId },
      update: {},
    });
    return { success: true, siguiendo: true };
  }

  async dejarDeSeguirPareja(userId: string, inscripcionId: string) {
    await this.prisma.seguimientoPareja.deleteMany({ where: { userId, inscripcionId } });
    return { success: true, siguiendo: false };
  }

  /**
   * Parejas que el usuario sigue dentro de un torneo. Devuelve la inscripción y
   * los ids de sus jugadores (la app resalta el cuadro por jugador).
   */
  async parejasSeguidasEnTorneo(userId: string, tournamentId: string) {
    const seguidas = await this.prisma.seguimientoPareja.findMany({
      where: { userId },
      select: { inscripcionId: true },
    });
    if (seguidas.length === 0) return [];
    const ids = seguidas.map((s) => s.inscripcionId);
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { id: { in: ids }, tournamentId },
      select: { id: true, jugador1Id: true, jugador2Id: true },
    });
    return inscripciones.map((i) => ({
      inscripcionId: i.id,
      jugadorIds: [i.jugador1Id, i.jugador2Id].filter((x): x is string => !!x),
    }));
  }
}
