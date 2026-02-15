import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get feed for a premium user: posts from people they follow (who are also premium)
   */
  async obtenerFeed(userId: string, page = 1, limit = 20) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.esPremium) {
      throw new ForbiddenException('Necesitas FairPadel Premium para acceder al feed');
    }

    // Get IDs of users I follow
    const seguimientos = await this.prisma.seguimiento.findMany({
      where: { seguidorId: userId },
      select: { seguidoId: true },
    });

    const seguidosIds = seguimientos.map((s) => s.seguidoId);

    // Include own posts + posts from followed premium users
    const publicaciones = await this.prisma.publicacionFeed.findMany({
      where: {
        OR: [
          { userId }, // My own posts
          {
            userId: { in: seguidosIds },
            user: { esPremium: true }, // Only from premium followed users
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
        foto: {
          select: {
            id: true,
            urlImagen: true,
            urlThumbnail: true,
            descripcion: true,
          },
        },
        match: {
          select: {
            id: true,
            ronda: true,
            set1Pareja1: true,
            set1Pareja2: true,
            set2Pareja1: true,
            set2Pareja2: true,
            set3Pareja1: true,
            set3Pareja2: true,
            pareja1: {
              select: {
                jugador1: { select: { id: true, nombre: true, apellido: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true } },
              },
            },
            pareja2: {
              select: {
                jugador1: { select: { id: true, nombre: true, apellido: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true } },
              },
            },
            parejaGanadora: {
              select: {
                jugador1: { select: { id: true, nombre: true, apellido: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true } },
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            nombre: true,
          },
        },
        likesPublicacion: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return publicaciones.map((p) => ({
      ...p,
      likedByMe: p.likesPublicacion.length > 0,
      likesPublicacion: undefined,
    }));
  }

  /**
   * Create a photo publication (user uploads photo to feed)
   */
  async crearPublicacionFoto(userId: string, contenido?: string, fotoId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.esPremium) {
      throw new ForbiddenException('Necesitas FairPadel Premium para publicar en el feed');
    }

    if (!fotoId && !contenido) {
      throw new BadRequestException('Debes incluir una foto o contenido');
    }

    return this.prisma.publicacionFeed.create({
      data: {
        userId,
        tipo: 'FOTO',
        contenido,
        fotoId,
      },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true, esPremium: true },
        },
        foto: {
          select: { id: true, urlImagen: true, urlThumbnail: true, descripcion: true },
        },
      },
    });
  }

  /**
   * Auto-create a match result publication (called from matches service)
   */
  async crearPublicacionResultado(
    userId: string,
    matchId: string,
    tournamentId: string,
    categoriaId?: string,
    contenido?: string,
  ) {
    return this.prisma.publicacionFeed.create({
      data: {
        userId,
        tipo: 'RESULTADO',
        matchId,
        tournamentId,
        categoriaId,
        contenido,
      },
    });
  }

  /**
   * Auto-create an achievement publication (e.g. 3rd consecutive win)
   */
  async crearPublicacionLogro(userId: string, contenido: string, datosExtra?: string) {
    return this.prisma.publicacionFeed.create({
      data: {
        userId,
        tipo: 'LOGRO',
        contenido,
        datosExtra,
      },
    });
  }

  /**
   * Auto-create a category promotion publication
   */
  async crearPublicacionAscenso(
    userId: string,
    contenido: string,
    categoriaId?: string,
    datosExtra?: string,
  ) {
    return this.prisma.publicacionFeed.create({
      data: {
        userId,
        tipo: 'ASCENSO',
        contenido,
        categoriaId,
        datosExtra,
      },
    });
  }

  /**
   * Like/unlike a publication
   */
  async toggleLike(publicacionId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.esPremium) {
      throw new ForbiddenException('Necesitas FairPadel Premium');
    }

    const existingLike = await this.prisma.likePublicacion.findUnique({
      where: {
        publicacionId_userId: { publicacionId, userId },
      },
    });

    if (existingLike) {
      await this.prisma.likePublicacion.delete({
        where: { id: existingLike.id },
      });
      await this.prisma.publicacionFeed.update({
        where: { id: publicacionId },
        data: { likesCount: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await this.prisma.likePublicacion.create({
        data: { publicacionId, userId },
      });
      await this.prisma.publicacionFeed.update({
        where: { id: publicacionId },
        data: { likesCount: { increment: 1 } },
      });
      return { liked: true };
    }
  }

  /**
   * Comment on a publication
   */
  async comentar(publicacionId: string, userId: string, contenido: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.esPremium) {
      throw new ForbiddenException('Necesitas FairPadel Premium');
    }

    const publicacion = await this.prisma.publicacionFeed.findUnique({
      where: { id: publicacionId },
    });
    if (!publicacion) {
      throw new NotFoundException('Publicación no encontrada');
    }

    const comentario = await this.prisma.comentarioPublicacion.create({
      data: { publicacionId, userId, contenido },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true },
        },
      },
    });

    await this.prisma.publicacionFeed.update({
      where: { id: publicacionId },
      data: { comentariosCount: { increment: 1 } },
    });

    return comentario;
  }

  /**
   * Get comments for a publication
   */
  async obtenerComentarios(publicacionId: string, page = 1, limit = 20) {
    return this.prisma.comentarioPublicacion.findMany({
      where: { publicacionId },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Delete own publication
   */
  async eliminarPublicacion(publicacionId: string, userId: string) {
    const publicacion = await this.prisma.publicacionFeed.findUnique({
      where: { id: publicacionId },
    });

    if (!publicacion) {
      throw new NotFoundException('Publicación no encontrada');
    }

    if (publicacion.userId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta publicación');
    }

    await this.prisma.publicacionFeed.delete({
      where: { id: publicacionId },
    });

    return { deleted: true };
  }
}
