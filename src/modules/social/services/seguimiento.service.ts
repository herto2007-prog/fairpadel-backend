import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class SeguimientoService {
  private readonly logger = new Logger(SeguimientoService.name);

  constructor(private prisma: PrismaService) {}

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
}
