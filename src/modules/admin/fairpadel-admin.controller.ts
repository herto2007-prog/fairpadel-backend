import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

@Controller('fairpadel/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FairpadelAdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Dashboard de FairPadel (solo para dueño/admin)
   */
  @Get('dashboard')
  async getDashboard() {
    const [
      totalTorneos,
      torneosActivos,
      torneosBloqueados,
      totalJugadores,
      comisionesPendientes,
      configComision,
    ] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.tournament.count({
        where: { estado: { in: ['PUBLICADO', 'EN_CURSO'] } },
      }),
      this.prisma.torneoComision.count({
        where: { bloqueoActivo: true },
      }),
      this.prisma.user.count(),
      this.prisma.torneoComision.aggregate({
        where: { estado: { in: ['PENDIENTE', 'PENDIENTE_VERIFICACION'] } },
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
        torneosBloqueados,
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
    @Body('user') user: any,
  ) {
    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        estado: 'PAGADO',
        montoPagado: dto.montoPagado,
        bloqueoActivo: false,
        pagadoAt: new Date(),
        revisadoPor: user.id,
      },
    });

    return {
      success: true,
      message: 'Torneo liberado correctamente',
      comision,
    };
  }

  /**
   * Soft cancel (volver a bloquear si fue liberado por error)
   */
  @Post('torneos/:id/bloquear')
  async bloquearTorneo(
    @Param('id') tournamentId: string,
    @Body() user: any,
  ) {
    const configRonda = await this.prisma.fairpadelConfig.findUnique({
      where: { clave: 'RONDA_BLOQUEO_PAGO' },
    });

    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        estado: 'PENDIENTE',
        bloqueoActivo: true,
        rondaBloqueo: configRonda?.valor || 'CUARTOS',
      },
    });

    return {
      success: true,
      message: 'Torneo bloqueado',
      comision,
    };
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
