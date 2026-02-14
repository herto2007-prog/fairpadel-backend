import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class FotosService {
  private readonly logger = new Logger(FotosService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async subirFoto(userId: string, file: Express.Multer.File, data: any) {
    // Verificar límite de fotos para usuarios no premium
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!usuario.esPremium) {
      const fotosActuales = await this.prisma.foto.count({
        where: { userId },
      });

      if (fotosActuales >= 6) {
        throw new BadRequestException(
          'Has alcanzado el límite de 6 fotos. Hazte Premium para fotos ilimitadas',
        );
      }
    }

    // Determinar folder y transformación según tipo
    const tipo = data.tipo || 'PERSONAL';
    let folder = 'fairpadel/galeria';
    let transformation: Record<string, any>[] | undefined;

    if (tipo === 'TORNEO' && data.tournamentId) {
      folder = `fairpadel/torneos/${data.tournamentId}`;
      transformation = [CloudinaryService.PRESETS.GALLERY];
    } else if (tipo === 'FLYER') {
      folder = 'fairpadel/flyers';
      transformation = [CloudinaryService.PRESETS.TOURNAMENT_FLYER];
    } else {
      transformation = [CloudinaryService.PRESETS.GALLERY];
    }

    // Subir a Cloudinary
    const resultado = await this.cloudinary.uploadImage(file, {
      folder,
      transformation,
    });

    // Crear registro en BD
    const foto = await this.prisma.foto.create({
      data: {
        userId,
        urlImagen: resultado.url,
        urlThumbnail: resultado.thumbnailUrl,
        cloudinaryPublicId: resultado.publicId,
        descripcion: data.descripcion,
        tournamentId: data.tournamentId,
        tipo,
        estadoModeracion: 'PENDIENTE',
      },
    });

    this.logger.log(`Foto subida por user ${userId}: ${foto.id}`);

    return foto;
  }

  async obtenerFotos(filtros: any) {
    const where: any = {
      estadoModeracion: 'APROBADA',
    };

    if (filtros.userId) {
      where.userId = filtros.userId;
    }

    if (filtros.tournamentId) {
      where.tournamentId = filtros.tournamentId;
    }

    if (filtros.tipo) {
      where.tipo = filtros.tipo;
    }

    const fotos = await this.prisma.foto.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return fotos;
  }

  async obtenerFotoDetalle(id: string) {
    const foto = await this.prisma.foto.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    return foto;
  }

  async actualizarFoto(id: string, data: any, userId: string) {
    const foto = await this.prisma.foto.findUnique({
      where: { id },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    if (foto.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar esta foto');
    }

    const fotoActualizada = await this.prisma.foto.update({
      where: { id },
      data: {
        descripcion: data.descripcion,
      },
    });

    return fotoActualizada;
  }

  async eliminarFoto(id: string, userId: string) {
    const foto = await this.prisma.foto.findUnique({
      where: { id },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    if (foto.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta foto');
    }

    // Eliminar de Cloudinary si tiene publicId
    if (foto.cloudinaryPublicId) {
      await this.cloudinary.deleteImage(foto.cloudinaryPublicId);
    }

    await this.prisma.foto.delete({
      where: { id },
    });

    return { message: 'Foto eliminada' };
  }

  async darLike(fotoId: string, userId: string) {
    // Verificar si ya dio like
    const likeExistente = await this.prisma.like.findFirst({
      where: {
        fotoId,
        userId,
      },
    });

    if (likeExistente) {
      // Quitar like
      await this.prisma.like.delete({
        where: { id: likeExistente.id },
      });

      await this.prisma.foto.update({
        where: { id: fotoId },
        data: {
          likesCount: {
            decrement: 1,
          },
        },
      });

      return { message: 'Like eliminado' };
    }

    // Dar like
    await this.prisma.like.create({
      data: {
        fotoId,
        userId,
      },
    });

    await this.prisma.foto.update({
      where: { id: fotoId },
      data: {
        likesCount: {
          increment: 1,
        },
      },
    });

    return { message: 'Like agregado' };
  }

  async obtenerLikes(fotoId: string) {
    const likes = await this.prisma.like.findMany({
      where: { fotoId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
    });

    return likes;
  }

  async comentar(fotoId: string, userId: string, contenido: string) {
    const comentario = await this.prisma.comentario.create({
      data: {
        fotoId,
        userId,
        contenido,
      },
    });

    await this.prisma.foto.update({
      where: { id: fotoId },
      data: {
        comentariosCount: {
          increment: 1,
        },
      },
    });

    return comentario;
  }

  async obtenerComentarios(fotoId: string) {
    const comentarios = await this.prisma.comentario.findMany({
      where: { fotoId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return comentarios;
  }

  async eliminarComentario(comentarioId: string, userId: string) {
    const comentario = await this.prisma.comentario.findUnique({
      where: { id: comentarioId },
    });

    if (!comentario) {
      throw new NotFoundException('Comentario no encontrado');
    }

    if (comentario.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este comentario');
    }

    await this.prisma.comentario.delete({
      where: { id: comentarioId },
    });

    await this.prisma.foto.update({
      where: { id: comentario.fotoId },
      data: {
        comentariosCount: {
          decrement: 1,
        },
      },
    });

    return { message: 'Comentario eliminado' };
  }

  async reportarFoto(fotoId: string, userId: string, motivo: string) {
    await this.prisma.reporteFoto.create({
      data: {
        fotoId,
        userId,
        motivo,
      },
    });

    return { message: 'Foto reportada. Un administrador la revisará' };
  }
}
