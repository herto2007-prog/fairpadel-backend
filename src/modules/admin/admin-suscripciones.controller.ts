import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/suscripciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSuscripcionesController {
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

    const hoy = new Date();
    const sieteDias = new Date();
    sieteDias.setDate(sieteDias.getDate() + 7);

    // Construir where según filtro
    let where: any = {};
    
    if (filtro === 'activas') {
      where = {
        suscripcionActiva: true,
        suscripcionVenceEn: {
          gte: hoy,
        },
      };
    } else if (filtro === 'por-vencer') {
      where = {
        suscripcionActiva: true,
        suscripcionVenceEn: {
          gte: hoy,
          lte: sieteDias,
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
        pagos: {
          where: {
            estado: 'COMPLETADO',
          },
          orderBy: {
            fechaPago: 'desc',
          },
          take: 1,
          select: {
            fechaPago: true,
            monto: true,
          },
        },
      },
    });

    // Formatear respuesta
    const data = suscripciones.map((config) => {
      const ultimoPago = config.pagos[0];
      const diasRestantes = config.suscripcionVenceEn
        ? Math.ceil(
            (new Date(config.suscripcionVenceEn).getTime() - hoy.getTime()) /
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
    const hoy = new Date();
    const sieteDias = new Date();
    sieteDias.setDate(sieteDias.getDate() + 7);

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
            lte: sieteDias,
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

      // Total recaudado este mes
      this.prisma.alquilerPago.aggregate({
        where: {
          estado: 'COMPLETADO',
          fechaPago: {
            gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
          },
        },
        _sum: {
          monto: true,
        },
      }),

      // Historial últimos 6 meses
      this.prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', fecha_pago) as mes,
          COUNT(*) as cantidad,
          SUM(monto) as total
        FROM alquiler_pagos
        WHERE estado = 'COMPLETADO'
          AND fecha_pago >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
        GROUP BY DATE_TRUNC('month', fecha_pago)
        ORDER BY mes DESC
      `,
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
    @Query('estado') estado: string = 'COMPLETADO',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (estado !== 'todos') {
      where.estado = estado;
    }

    const [total, pagos] = await Promise.all([
      this.prisma.alquilerPago.count({ where }),
      this.prisma.alquilerPago.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sede: {
            select: {
              nombre: true,
              ciudad: true,
              dueno: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: pagos.map((pago) => ({
        id: pago.id,
        sede: pago.sede,
        monto: pago.monto,
        montoUSD: (pago.monto / 100).toFixed(2),
        estado: pago.estado,
        metodo: pago.metodo,
        referencia: pago.referencia,
        fechaPago: pago.fechaPago,
        periodoDesde: pago.periodoDesde,
        periodoHasta: pago.periodoHasta,
        createdAt: pago.createdAt,
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
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
}
