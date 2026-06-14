import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { AuditoriaAccionesService } from '../../common/services/auditoria-acciones.service';

class UpdateConfigDto {
  @IsString()
  valor: string;
}

class LiberarTorneoDto {
  @IsNumber()
  montoPagado: number;

  @IsString()
  @IsOptional()
  notas?: string;
}

class ExonerarTorneoDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}

@Controller('fairpadel/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FairpadelAdminController {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaAccionesService,
  ) {}

  /**
   * Dashboard de FairPadel (solo para dueño/admin)
   */
  @Get('dashboard')
  async getDashboard() {
    const [
      totalTorneos,
      torneosActivos,
      torneosPorCobrar,
      totalJugadores,
      comisionesPendientes,
      configComision,
    ] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.tournament.count({
        where: { estado: { in: ['PUBLICADO', 'EN_CURSO'] } },
      }),
      // Torneos terminados con comisión aún sin cobrar (incluye los que ya
      // subieron comprobante y esperan verificación).
      this.prisma.torneoComision.count({
        where: { estado: { in: ['POR_COBRAR', 'PENDIENTE_VERIFICACION'] } },
      }),
      this.prisma.user.count(),
      this.prisma.torneoComision.aggregate({
        where: { estado: { in: ['PENDIENTE', 'PENDIENTE_PAGO', 'PENDIENTE_VERIFICACION', 'POR_COBRAR'] } },
        _sum: { montoEstimado: true },
      }),
      this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      }),
    ]);

    // Calcular ingresos estimados del mes
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const comisionesMes = await this.prisma.torneoComision.aggregate({
      where: {
        pagadoAt: { gte: inicioMes },
        estado: 'PAGADO',
      },
      _sum: { montoPagado: true },
    });

    return {
      stats: {
        totalTorneos,
        torneosActivos,
        torneosPorCobrar,
        totalJugadores,
        comisionPendienteTotal: comisionesPendientes._sum.montoEstimado || 0,
        ingresosMes: comisionesMes._sum.montoPagado || 0,
        comisionConfigurada: parseInt(configComision?.valor || '0'),
      },
    };
  }

  /**
   * Listar todas las configuraciones de FairPadel
   */
  @Get('config')
  async getConfig() {
    const configs = await this.prisma.fairpadelConfig.findMany({
      orderBy: { clave: 'asc' },
    });
    return { configs };
  }

  /**
   * Actualizar una configuración
   */
  @Put('config/:clave')
  async updateConfig(
    @Param('clave') clave: string,
    @Body() dto: UpdateConfigDto,
  ) {
    const config = await this.prisma.fairpadelConfig.update({
      where: { clave },
      data: { valor: dto.valor },
    });
    return {
      success: true,
      message: 'Configuración actualizada',
      config,
    };
  }

  /**
   * Listar torneos bloqueados (pendientes de pago)
   */
  @Get('torneos/bloqueados')
  async getTorneosBloqueados() {
    const torneos = await this.prisma.torneoComision.findMany({
      where: {
        OR: [
          { bloqueoActivo: true },
          { estado: 'PENDIENTE_VERIFICACION' },
        ],
      },
      include: {
        tournament: {
          include: {
            organizador: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
            _count: {
              select: { inscripciones: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      torneos: torneos.map(t => ({
        id: t.tournament.id,
        nombre: t.tournament.nombre,
        organizador: t.tournament.organizador,
        inscripciones: t.tournament._count.inscripciones,
        comision: {
          estado: t.estado,
          montoEstimado: t.montoEstimado,
          montoPagado: t.montoPagado,
          comprobanteUrl: t.comprobanteUrl,
          bloqueoActivo: t.bloqueoActivo,
          rondaBloqueo: t.rondaBloqueo,
        },
      })),
    };
  }

  /**
   * GET /fairpadel/admin/torneos/comisiones
   * Listar todos los torneos con su estado de comisión
   */
  @Get('torneos/comisiones')
  async getTorneosComisiones(
    @Query('estado') estado?: string, // todos | por_cobrar | verificar | pagados | exonerados
    @Query('busqueda') busqueda?: string,
  ) {
    const whereComision: any = {};

    if (estado === 'por_cobrar') {
      whereComision.estado = 'POR_COBRAR';
    } else if (estado === 'verificar') {
      whereComision.estado = 'PENDIENTE_VERIFICACION';
    } else if (estado === 'pagados') {
      whereComision.estado = 'PAGADO';
    } else if (estado === 'exonerados') {
      whereComision.estado = 'EXONERADO';
    }

    const comisiones = await this.prisma.torneoComision.findMany({
      where: whereComision,
      include: {
        tournament: {
          include: {
            organizador: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
            _count: {
              select: { inscripciones: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filtro de búsqueda por nombre de torneo u organizador
    let resultado = comisiones;
    if (busqueda?.trim()) {
      const q = busqueda.toLowerCase();
      resultado = comisiones.filter(
        (c) =>
          c.tournament.nombre.toLowerCase().includes(q) ||
          `${c.tournament.organizador.nombre} ${c.tournament.organizador.apellido}`.toLowerCase().includes(q) ||
          c.tournament.organizador.email.toLowerCase().includes(q)
      );
    }

    return {
      torneos: resultado.map((c) => ({
        id: c.tournament.id,
        nombre: c.tournament.nombre,
        organizador: c.tournament.organizador,
        inscripciones: c.tournament._count.inscripciones,
        comision: {
          estado: c.estado,
          montoEstimado: c.montoEstimado,
          montoPagado: c.montoPagado,
          comprobanteUrl: c.comprobanteUrl,
          bloqueoActivo: c.bloqueoActivo,
          rondaBloqueo: c.rondaBloqueo,
        },
      })),
    };
  }

  /**
   * Ver detalle completo de un torneo para admin
   */
  @Get('torneos/:id')
  async getTorneoDetalle(@Param('id') id: string) {
    const [torneo, comision, inscripciones] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id },
        include: {
          organizador: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
            },
          },
          categorias: {
            include: { category: true },
          },
          _count: {
            select: { inscripciones: true },
          },
        },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId: id },
      }),
      this.prisma.inscripcion.findMany({
        where: { tournamentId: id },
        include: {
          jugador1: {
            select: { id: true, nombre: true, apellido: true, fotoUrl: true },
          },
          jugador2: {
            select: { id: true, nombre: true, apellido: true, fotoUrl: true },
          },
          category: true,
        },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return {
      torneo: {
        ...torneo,
        comision,
      },
      inscripciones: inscripciones.map(i => ({
        id: i.id,
        categoria: i.category.nombre,
        jugador1: i.jugador1,
        jugador2: i.jugador2,
        estado: i.estado,
        modoPago: i.modoPago,
        createdAt: i.createdAt,
      })),
    };
  }

  /**
   * Liberar torneo (marcar comisión como pagada)
   */
  @Post('torneos/:id/liberar')
  async liberarTorneo(
    @Param('id') tournamentId: string,
    @Body() dto: LiberarTorneoDto,
    @GetUser() user: User,
  ) {
    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        estado: 'PAGADO',
        montoPagado: dto.montoPagado,
        bloqueoActivo: false,
        pagadoAt: new Date(),
        revisadoPor: user.id,
        ...(dto.notas ? { comprobanteNotas: dto.notas } : {}),
      },
    });

    await this.auditoria.registrar(user.id, 'LIBERAR_COMISION', 'tournament', tournamentId, {
      montoPagado: dto.montoPagado,
      notas: dto.notas,
    });

    return {
      success: true,
      message: 'Torneo liberado correctamente',
      comision,
    };
  }

  /**
   * Exonerar torneo (no se cobra comisión)
   */
  @Post('torneos/:id/exonerar')
  async exonerarTorneo(
    @Param('id') tournamentId: string,
    @Body() dto: ExonerarTorneoDto,
    @GetUser() user: User,
  ) {
    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        estado: 'EXONERADO',
        bloqueoActivo: false,
        montoPagado: 0,
        comprobanteNotas: dto.motivo || 'Exonerado por admin',
        revisadoPor: user.id,
      },
    });

    await this.auditoria.registrar(user.id, 'EXONERAR_COMISION', 'tournament', tournamentId, {
      motivo: dto.motivo,
    });

    return {
      success: true,
      message: 'Torneo exonerado correctamente',
      comision,
    };
  }

  /**
   * Historial de acciones sensibles (auditoría)
   */
  @Get('auditoria-acciones')
  async listarAuditoria(
    @Query('limit') limit?: string,
    @Query('entidadId') entidadId?: string,
    @Query('accion') accion?: string,
  ) {
    const acciones = await this.auditoria.listar({
      limit: limit ? parseInt(limit, 10) : undefined,
      entidadId,
      accion,
    });
    return { success: true, acciones };
  }

  /**
   * Obtener datos bancarios configurados (para mostrar en frontend de organizador)
   */
  @Get('datos-bancarios')
  async getDatosBancarios() {
    const configs = await this.prisma.fairpadelConfig.findMany({
      where: {
        clave: {
          in: ['BANCO_CUENTA', 'BANCO_NUMERO_CUENTA', 'BANCO_ALIAS', 'BANCO_TITULAR', 'WHATSAPP_ADMIN'],
        },
      },
    });

    const datosBancarios = {
      banco: configs.find(c => c.clave === 'BANCO_CUENTA')?.valor || '',
      numeroCuenta: configs.find(c => c.clave === 'BANCO_NUMERO_CUENTA')?.valor || '',
      alias: configs.find(c => c.clave === 'BANCO_ALIAS')?.valor || '',
      titular: configs.find(c => c.clave === 'BANCO_TITULAR')?.valor || '',
      whatsapp: configs.find(c => c.clave === 'WHATSAPP_ADMIN')?.valor || '',
    };

    return { datosBancarios };
  }
}
