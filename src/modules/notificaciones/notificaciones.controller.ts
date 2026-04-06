import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /notificaciones
   * Obtiene todas las notificaciones del usuario autenticado
   */
  @Get()
  async getMisNotificaciones(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('soloNoLeidas') soloNoLeidas: string = 'false',
  ) {
    const userId = req.user.userId;
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId };
    if (soloNoLeidas === 'true') {
      where.leida = false;
    }

    const [notificaciones, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          contenido: true,
          enlace: true,
          leida: true,
          createdAt: true,
        },
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    return {
      success: true,
      data: {
        notificaciones,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    };
  }

  /**
   * GET /notificaciones/no-leidas
   * Obtiene el contador de notificaciones no leídas
   */
  @Get('no-leidas')
  async getContadorNoLeidas(@Request() req: any) {
    const userId = req.user.userId;

    const count = await this.prisma.notificacion.count({
      where: {
        userId,
        leida: false,
      },
    });

    return {
      success: true,
      data: { count },
    };
  }

  /**
   * PUT /notificaciones/:id/leer
   * Marca una notificación como leída
   */
  @Put(':id/leer')
  async marcarComoLeida(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const userId = req.user.userId;

    const notificacion = await this.prisma.notificacion.updateMany({
      where: {
        id,
        userId, // Seguridad: solo puede marcar sus propias notificaciones
      },
      data: {
        leida: true,
      },
    });

    if (notificacion.count === 0) {
      return {
        success: false,
        message: 'Notificación no encontrada',
      };
    }

    return {
      success: true,
      message: 'Notificación marcada como leída',
    };
  }

  /**
   * PUT /notificaciones/leer-todas
   * Marca todas las notificaciones del usuario como leídas
   */
  @Put('leer-todas')
  async marcarTodasComoLeidas(@Request() req: any) {
    const userId = req.user.userId;

    const result = await this.prisma.notificacion.updateMany({
      where: {
        userId,
        leida: false,
      },
      data: {
        leida: true,
      },
    });

    return {
      success: true,
      message: `${result.count} notificaciones marcadas como leídas`,
      data: { marcadas: result.count },
    };
  }

  /**
   * DELETE /notificaciones/:id
   * Elimina una notificación
   */
  @Delete(':id')
  async eliminarNotificacion(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const userId = req.user.userId;

    try {
      await this.prisma.notificacion.delete({
        where: {
          id,
          userId, // Seguridad: solo puede eliminar sus propias notificaciones
        },
      });

      return {
        success: true,
        message: 'Notificación eliminada',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Notificación no encontrada',
      };
    }
  }
}
