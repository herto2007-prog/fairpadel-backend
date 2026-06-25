import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';

export interface CrearPublicacionDto {
  texto?: string;
  fotoUrl?: string;
  fotoPublicId?: string;
}

@Injectable()
export class PublicacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  /** Crea una publicación del jugador (foto y/o texto). Aparece en el feed. */
  async crear(userId: string, dto: CrearPublicacionDto) {
    const texto = (dto.texto || '').trim();
    const fotoUrl = (dto.fotoUrl || '').trim();
    if (!texto && !fotoUrl) {
      throw new BadRequestException('La publicación necesita una foto o un texto');
    }

    let fotoId: string | undefined;
    if (fotoUrl) {
      const foto = await this.prisma.foto.create({
        data: {
          userId,
          urlImagen: fotoUrl,
          cloudinaryPublicId: dto.fotoPublicId || null,
          tipo: 'PERSONAL',
          estadoModeracion: 'APROBADO',
        },
        select: { id: true },
      });
      fotoId = foto.id;
    }

    const pub = await this.prisma.publicacionFeed.create({
      data: {
        userId,
        tipo: fotoUrl ? 'FOTO' : 'NORMAL',
        contenido: texto || null,
        fotoId,
      },
      select: { id: true },
    });

    return { id: pub.id };
  }

  /**
   * Publicaciones de un jugador (para su ficha — grid estilo Instagram).
   * Incluye contador de reacciones y si el que mira ya reaccionó (feedItemId = p-<id>).
   */
  async listarDeUsuario(viewerId: string, userId: string) {
    const posts = await this.prisma.publicacionFeed.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        contenido: true,
        createdAt: true,
        foto: { select: { urlImagen: true } },
      },
    });
    if (posts.length === 0) return [];

    const feedIds = posts.map((p) => `p-${p.id}`);
    const [grupos, mias] = await Promise.all([
      this.prisma.reaccionFeed.groupBy({
        by: ['feedItemId'],
        where: { feedItemId: { in: feedIds } },
        _count: { _all: true },
      }),
      this.prisma.reaccionFeed.findMany({
        where: { feedItemId: { in: feedIds }, userId: viewerId },
        select: { feedItemId: true },
      }),
    ]);
    const countMap = new Map(grupos.map((g) => [g.feedItemId, g._count._all]));
    const miasSet = new Set(mias.map((m) => m.feedItemId));

    return posts.map((p) => {
      const feedItemId = `p-${p.id}`;
      return {
        id: p.id,
        feedItemId,
        fotoUrl: p.foto?.urlImagen ?? null,
        contenido: p.contenido ?? '',
        fecha: p.createdAt.toISOString(),
        reaccionesCount: countMap.get(feedItemId) ?? 0,
        yaReaccione: miasSet.has(feedItemId),
        esDueno: userId === viewerId,
      };
    });
  }

  /** Borra una publicación propia (y su foto en Cloudinary + reacciones del feed). */
  async eliminar(userId: string, id: string) {
    const pub = await this.prisma.publicacionFeed.findUnique({
      where: { id },
      select: { userId: true, fotoId: true, foto: { select: { cloudinaryPublicId: true } } },
    });
    if (!pub) throw new NotFoundException('Publicación no encontrada');
    if (pub.userId !== userId) {
      throw new ForbiddenException('No podés borrar una publicación que no es tuya');
    }

    await this.prisma.publicacionFeed.delete({ where: { id } });
    if (pub.fotoId) {
      // Borrar el archivo en Cloudinary (best-effort) antes del registro
      const publicId = pub.foto?.cloudinaryPublicId;
      if (publicId) {
        await this.uploadsService.deleteImage(publicId).catch(() => undefined);
      }
      await this.prisma.foto.deleteMany({ where: { id: pub.fotoId } });
    }
    // Limpiar reacciones del feed asociadas (no tienen FK, se borran por clave)
    await this.prisma.reaccionFeed.deleteMany({ where: { feedItemId: `p-${id}` } });

    return { ok: true };
  }
}
