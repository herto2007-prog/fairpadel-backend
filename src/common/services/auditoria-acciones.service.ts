import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Registro de auditoría de acciones sensibles (quién hizo qué y cuándo).
 * Best-effort A PROPÓSITO: si el registro falla, NUNCA debe romper la
 * operación de negocio que lo llama — solo se loguea el error.
 */
@Injectable()
export class AuditoriaAccionesService {
  private readonly logger = new Logger(AuditoriaAccionesService.name);

  constructor(private prisma: PrismaService) {}

  async registrar(
    userId: string,
    accion: string,
    entidad: string,
    entidadId: string,
    detalle?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditoriaAccion.create({
        data: { userId, accion, entidad, entidadId, detalle: detalle ?? undefined },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar auditoría (${accion} ${entidad}/${entidadId} por ${userId}):`,
        error,
      );
    }
  }

  async listar(opciones: { limit?: number; entidadId?: string; accion?: string } = {}) {
    const { limit = 50, entidadId, accion } = opciones;
    return this.prisma.auditoriaAccion.findMany({
      where: {
        ...(entidadId ? { entidadId } : {}),
        ...(accion ? { accion } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
