import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Centro de Sedes: una sola fuente de datos para la ficha unificada de cada
 * sede (datos + canchas + responsables + servicio de reservas). Las escrituras
 * siguen viviendo en sus endpoints existentes (admin/sedes para sede/canchas,
 * admin/sedes/:id/asignar-* para responsables, admin/suscripciones/* para el
 * servicio). Esto evita el solapamiento histórico de los dos controllers que
 * comparten la base admin/sedes.
 */
@Controller('admin/centro-sedes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCentroSedesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /admin/centro-sedes
   * Lista TODAS las sedes (activas e inactivas) con todo lo que necesita la
   * ficha: canchas, dueño, encargado y resumen del servicio de reservas.
   */
  @Get()
  async listar() {
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const sedes = await this.prisma.sede.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        canchas: {
          orderBy: { nombre: 'asc' },
        },
        dueno: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        encargado: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        alquilerConfig: {
          select: {
            habilitado: true,
            suscripcionActiva: true,
            suscripcionVenceEn: true,
            tipoSuscripcion: true,
          },
        },
      },
    });

    return sedes.map((sede) => {
      const cfg = sede.alquilerConfig;
      const diasRestantes = cfg?.suscripcionVenceEn
        ? Math.max(
            0,
            Math.ceil(
              (new Date(cfg.suscripcionVenceEn + 'T00:00:00').getTime() -
                new Date(hoy + 'T00:00:00').getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

      // Servicio "vigente" = suscripción activa y no vencida
      const servicioActivo =
        !!cfg?.suscripcionActiva &&
        !!cfg?.suscripcionVenceEn &&
        cfg.suscripcionVenceEn >= hoy;

      return {
        id: sede.id,
        nombre: sede.nombre,
        ciudad: sede.ciudad,
        direccion: sede.direccion,
        telefono: sede.telefono,
        mapsUrl: sede.mapsUrl,
        logoUrl: sede.logoUrl,
        activa: sede.activa,
        canchas: sede.canchas.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          tieneLuz: c.tieneLuz,
          cubierta: c.cubierta,
          notas: c.notas,
          activa: c.activa,
        })),
        dueno: sede.dueno,
        encargado: sede.encargado,
        servicio: cfg
          ? {
              habilitado: cfg.habilitado,
              suscripcionActiva: servicioActivo,
              suscripcionVenceEn: cfg.suscripcionVenceEn,
              tipoSuscripcion: cfg.tipoSuscripcion,
              diasRestantes,
            }
          : null,
      };
    });
  }

  /**
   * GET /admin/centro-sedes/:sedeId/pagos
   * Historial de pagos del servicio de reservas de una sede.
   */
  @Get(':sedeId/pagos')
  async pagos(@Param('sedeId') sedeId: string) {
    const pagos = await this.prisma.alquilerPago.findMany({
      where: { sedeId },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        fechaPago: true,
        periodoDesde: true,
        periodoHasta: true,
        monto: true,
        moneda: true,
        metodo: true,
        estado: true,
        createdAt: true,
      },
    });
    return pagos;
  }
}
