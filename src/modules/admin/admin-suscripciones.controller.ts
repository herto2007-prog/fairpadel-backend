import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/suscripciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSuscripcionesController {
  private readonly logger = new Logger(AdminSuscripcionesController.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /admin/suscripciones/sedes
   * Listar suscripciones de sedes con filtros
   */
  @Get('sedes')
  async listarSuscripcionesSedes(
    @Query('filtro') filtro: 'todas' | 'activas' | 'por-vencer' | 'vencidas' = 'todas',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fechas como strings YYYY-MM-DD (evita problemas de zona horaria)
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sieteDias = new Date();
    sieteDias.setDate(sieteDias.getDate() + 7);
    const sieteDiasStr = sieteDias.toISOString().split('T')[0]; // YYYY-MM-DD

    // Construir where según filtro (comparación de strings funciona para fechas YYYY-MM-DD)
    let where: any = {};
    
    if (filtro === 'activas') {
      where = {
        suscripcionActiva: true,
        suscripcionVenceEn: {
          gte: hoy, // String comparison: "2026-04-10" >= "2026-04-03"
        },
      };
    } else if (filtro === 'por-vencer') {
      where = {
        suscripcionActiva: true,
        suscripcionVenceEn: {
          gte: hoy,
          lte: sieteDiasStr,
        },
      };
    } else if (filtro === 'vencidas') {
      where = {
        OR: [
          {
            suscripcionActiva: false,
          },
          {
            suscripcionActiva: true,
            suscripcionVenceEn: {
              lt: hoy,
            },
          },
        ],
      };
    }

    // Obtener total para paginación
    const total = await this.prisma.alquilerConfig.count({ where });

    // Obtener suscripciones
    const suscripciones = await this.prisma.alquilerConfig.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: {
        suscripcionVenceEn: 'asc',
      },
      include: {
        sede: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            dueno: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
            _count: {
              select: {
                canchas: true,
              },
            },
          },
        },
        // pagos: temporalemente deshabilitado - tabla recreada vacia
      },
    });

    // Formatear respuesta
    const data = suscripciones.map((config) => {
      const ultimoPago = null; // config.pagos[0] - temporalmente deshabilitado
      const diasRestantes = config.suscripcionVenceEn
        ? Math.ceil(
            (new Date(config.suscripcionVenceEn + 'T00:00:00').getTime() - new Date(hoy + 'T00:00:00').getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        sedeId: config.sedeId,
        sedeNombre: config.sede.nombre,
        sedeCiudad: config.sede.ciudad,
        dueno: config.sede.dueno,
        canchasCount: config.sede._count.canchas,
        suscripcionActiva: config.suscripcionActiva,
        suscripcionVenceEn: config.suscripcionVenceEn,
        tipoSuscripcion: config.tipoSuscripcion,
        diasRestantes: diasRestantes > 0 ? diasRestantes : 0,
        ultimoPago: ultimoPago
          ? {
              fecha: ultimoPago.fechaPago,
              monto: ultimoPago.monto,
            }
          : null,
      };
    });

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        filtro,
      },
    };
  }

  /**
   * GET /admin/suscripciones/estadisticas
   * Estadísticas de suscripciones
   */
  @Get('estadisticas')
  async obtenerEstadisticas() {
    // Fechas como strings YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sieteDias = new Date();
    sieteDias.setDate(sieteDias.getDate() + 7);
    const sieteDiasStr = sieteDias.toISOString().split('T')[0]; // YYYY-MM-DD

    const [
      totalSedes,
      activas,
      porVencer,
      vencidas,
      totalRecaudadoMes,
      historialPagos,
    ] = await Promise.all([
      // Total sedes con config
      this.prisma.alquilerConfig.count(),
      
      // Activas
      this.prisma.alquilerConfig.count({
        where: {
          suscripcionActiva: true,
          suscripcionVenceEn: {
            gte: hoy,
          },
        },
      }),
      
      // Por vencer (próximos 7 días)
      this.prisma.alquilerConfig.count({
        where: {
          suscripcionActiva: true,
          suscripcionVenceEn: {
            gte: hoy,
            lte: sieteDiasStr,
          },
        },
      }),
      
      // Vencidas
      this.prisma.alquilerConfig.count({
        where: {
          OR: [
            {
              suscripcionActiva: false,
            },
            {
              suscripcionActiva: true,
              suscripcionVenceEn: {
                lt: hoy,
              },
            },
          ],
        },
      }),

      // Total recaudado este mes (comparación de strings YYYY-MM-DD)
      // Las fechas de pago son strings, así que usamos el primer día del mes actual
      this.prisma.alquilerPago.aggregate({
        where: {
          estado: 'COMPLETADO',
          fechaPago: {
            gte: hoy.substring(0, 8) + '01', // Primer día del mes actual: "2026-04-01"
          },
        },
        _sum: {
          monto: true,
        },
      }),

      // Historial últimos 6 meses - temporalmente deshabilitado
      Promise.resolve([]),
    ]);

    return {
      resumen: {
        totalSedes,
        activas,
        porVencer,
        vencidas,
        tasaActivacion: totalSedes > 0 ? Math.round((activas / totalSedes) * 100) : 0,
      },
      financiero: {
        recaudadoMes: totalRecaudadoMes._sum.monto || 0,
        recaudadoMesUSD: ((totalRecaudadoMes._sum.monto || 0) / 100).toFixed(2),
      },
      historial: historialPagos,
    };
  }

  /**
   * GET /admin/suscripciones/pagos
   * Listar todos los pagos de suscripciones
   */
  @Get('pagos')
  async listarPagos(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    // Temporalmente deshabilitado - tabla alquiler_pagos recreada vacia
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    return {
      data: [],
      meta: {
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
      },
    };
  }

  // ============================================
  // ENDPOINTS PLACEHOLDER PARA FUTURAS FEATURES
  // ============================================

  /**
   * GET /admin/suscripciones/instructores
   * PROXIMAMENTE: Suscripciones de instructores
   */
  @Get('instructores')
  async listarSuscripcionesInstructores() {
    return {
      message: 'Próximamente',
      data: [],
      meta: { total: 0 },
    };
  }

  /**
   * GET /admin/suscripciones/jugadores-premium
   * PROXIMAMENTE: Suscripciones de jugadores premium
   */
  @Get('jugadores-premium')
  async listarSuscripcionesJugadoresPremium() {
    return {
      message: 'Próximamente',
      data: [],
      meta: { total: 0 },
    };
  }

  // ============================================
  // ACTIVACIÓN MANUAL (REGALAR SUSCRIPCIONES)
  // ============================================

  /**
   * POST /admin/suscripciones/activar-manual
   * Activar suscripción manualmente (para testing o regalar)
   * Solo admin puede usar esto
   */
  @Post('activar-manual')
  async activarSuscripcionManual(
    @Body() body: {
      sedeId: string;
      tipo?: 'MENSUAL' | 'ANUAL';
      nota?: string;
    },
    @Request() req,
  ) {
    const { sedeId, tipo = 'MENSUAL', nota = 'Activación manual por admin' } = body;
    
    this.logger.log(`Admin ${req.user?.userId} activando suscripción manual para sede ${sedeId}`);

    // Fechas como strings YYYY-MM-DD
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    const meses = tipo === 'ANUAL' ? 12 : 1;
    const fechaVencimiento = new Date(hoy);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + meses);
    const fechaVencimientoStr = fechaVencimiento.toISOString().split('T')[0]; // YYYY-MM-DD

    // Buscar o crear config
    let config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
    });

    if (!config) {
      config = await this.prisma.alquilerConfig.create({
        data: {
          sedeId,
          habilitado: true,
          requiereAprobacion: true,
          duracionSlotMinutos: 90,
          anticipacionMaxDias: 14,
          cancelacionMinHoras: 4,
        },
      });
    }

    // Calcular monto
    const montoCentavos = tipo === 'ANUAL' ? 10800 : 1000; // $108.00 o $10.00

    // Crear pago COMPLETADO manualmente
    const pago = await this.prisma.alquilerPago.create({
      data: {
        sedeId,
        sedeConfigId: config.id,
        monto: montoCentavos,
        moneda: 'USD',
        estado: 'COMPLETADO',
        metodo: 'MANUAL',
        referencia: `MANUAL-${Date.now()}`,
        fechaPago: hoyStr,
        periodoDesde: hoyStr,
        periodoHasta: fechaVencimientoStr,
      },
    });

    // Activar suscripción
    await this.prisma.alquilerConfig.update({
      where: { id: config.id },
      data: {
        suscripcionActiva: true,
        suscripcionVenceEn: fechaVencimientoStr,
        tipoSuscripcion: tipo,
        habilitado: true,
      },
    });

    return {
      success: true,
      message: `Suscripción ${tipo} activada exitosamente`,
      data: {
        sedeId,
        tipo,
        monto: `$${(montoCentavos / 100).toFixed(2)} USD`,
        venceEn: fechaVencimientoStr,
        pagoId: pago.id,
        nota,
      },
    };
  }

  /**
   * POST /admin/suscripciones/desactivar
   * Desactivar suscripción (para testing)
   */
  @Post('desactivar')
  async desactivarSuscripcion(
    @Body() body: { sedeId: string; nota?: string },
    @Request() req,
  ) {
    this.logger.log(`Admin ${req.user?.userId} desactivando suscripción para sede ${body.sedeId}`);

    await this.prisma.alquilerConfig.updateMany({
      where: { sedeId: body.sedeId },
      data: {
        suscripcionActiva: false,
        suscripcionVenceEn: null,
      },
    });

    return {
      success: true,
      message: 'Suscripción desactivada',
    };
  }
}
