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
