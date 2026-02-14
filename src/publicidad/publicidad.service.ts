import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../fotos/cloudinary.service';
import { CreateBannerDto, UpdateBannerDto } from './dto';

@Injectable()
export class PublicidadService {
  private readonly logger = new Logger(PublicidadService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // ADMIN: CRUD BANNERS
  // ═══════════════════════════════════════════════════════

  async crearBanner(dto: CreateBannerDto, file?: Express.Multer.File) {
    let imagenUrl = '';
    let imagenPublicId: string | null = null;

    if (file) {
      const resultado = await this.cloudinary.uploadImage(file, {
        folder: 'fairpadel/banners',
        transformation: [CloudinaryService.PRESETS.BANNER],
      });
      imagenUrl = resultado.url;
      imagenPublicId = resultado.publicId;
    }

    const banner = await this.prisma.banner.create({
      data: {
        titulo: dto.titulo,
        imagenUrl,
        imagenPublicId,
        linkUrl: dto.linkUrl,
        zona: dto.zona as any,
        activo: dto.activo ?? true,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        orden: dto.orden ?? 0,
        anunciante: dto.anunciante,
      },
    });

    this.logger.log(`Banner creado: ${banner.id} (${banner.titulo})`);
    return banner;
  }

  async actualizarBanner(id: string, dto: UpdateBannerDto, file?: Express.Multer.File) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner no encontrado');

    let imagenUrl = existing.imagenUrl;
    let imagenPublicId = existing.imagenPublicId;

    // Si se sube nueva imagen, eliminar la anterior
    if (file) {
      if (existing.imagenPublicId) {
        await this.cloudinary.deleteImage(existing.imagenPublicId);
      }
      const resultado = await this.cloudinary.uploadImage(file, {
        folder: 'fairpadel/banners',
        transformation: [CloudinaryService.PRESETS.BANNER],
      });
      imagenUrl = resultado.url;
      imagenPublicId = resultado.publicId;
    }

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        titulo: dto.titulo ?? existing.titulo,
        imagenUrl,
        imagenPublicId,
        linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl,
        zona: dto.zona ? (dto.zona as any) : existing.zona,
        activo: dto.activo !== undefined ? dto.activo : existing.activo,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : existing.fechaInicio,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : existing.fechaFin,
        orden: dto.orden ?? existing.orden,
        anunciante: dto.anunciante !== undefined ? dto.anunciante : existing.anunciante,
      },
    });

    this.logger.log(`Banner actualizado: ${banner.id}`);
    return banner;
  }

  async eliminarBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner no encontrado');

    // Eliminar imagen de Cloudinary
    if (banner.imagenPublicId) {
      await this.cloudinary.deleteImage(banner.imagenPublicId);
    }

    await this.prisma.banner.delete({ where: { id } });
    this.logger.log(`Banner eliminado: ${id}`);
    return { message: 'Banner eliminado' };
  }

  async listarBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ zona: 'asc' }, { orden: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async obtenerBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner no encontrado');
    return banner;
  }

  async toggleActivo(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner no encontrado');

    return this.prisma.banner.update({
      where: { id },
      data: { activo: !banner.activo },
    });
  }

  async obtenerEstadisticas() {
    const banners = await this.prisma.banner.findMany({
      orderBy: { clicks: 'desc' },
    });

    const totalClicks = banners.reduce((sum, b) => sum + b.clicks, 0);
    const totalImpresiones = banners.reduce((sum, b) => sum + b.impresiones, 0);

    return {
      totalBanners: banners.length,
      bannersActivos: banners.filter((b) => b.activo).length,
      totalClicks,
      totalImpresiones,
      ctr: totalImpresiones > 0 ? ((totalClicks / totalImpresiones) * 100).toFixed(2) : '0.00',
      banners: banners.map((b) => ({
        id: b.id,
        titulo: b.titulo,
        zona: b.zona,
        activo: b.activo,
        clicks: b.clicks,
        impresiones: b.impresiones,
        ctr: b.impresiones > 0 ? ((b.clicks / b.impresiones) * 100).toFixed(2) : '0.00',
      })),
    };
  }

  // ═══════════════════════════════════════════════════════
  // PÚBLICO: BANNERS ACTIVOS POR ZONA
  // ═══════════════════════════════════════════════════════

  async obtenerBannersActivos(zona: string) {
    const ahora = new Date();

    return this.prisma.banner.findMany({
      where: {
        zona: zona as any,
        activo: true,
        OR: [
          // Sin rango de fechas (siempre activo)
          { fechaInicio: null, fechaFin: null },
          // Solo inicio, sin fin
          { fechaInicio: { lte: ahora }, fechaFin: null },
          // Rango completo
          { fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
          // Solo fin, sin inicio
          { fechaInicio: null, fechaFin: { gte: ahora } },
        ],
      },
      orderBy: [{ orden: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        titulo: true,
        imagenUrl: true,
        linkUrl: true,
        zona: true,
        anunciante: true,
      },
    });
  }

  async registrarClick(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner no encontrado');

    await this.prisma.banner.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });

    return { message: 'Click registrado' };
  }

  async registrarImpresion(ids: string[]) {
    if (!ids || ids.length === 0) return;

    await this.prisma.banner.updateMany({
      where: { id: { in: ids } },
      data: { impresiones: { increment: 1 } },
    });
  }
}
