import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ClasificacionService } from './clasificacion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';

@Controller()
export class ClasificacionController {
  constructor(private readonly clasificacionService: ClasificacionService) {}

  /**
   * GET /jugador/mi-clasificacion
   * Obtiene el estado de clasificación del jugador logueado
   */
  @Get('jugador/mi-clasificacion')
  @UseGuards(JwtAuthGuard)
  async getMiClasificacion(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    
    // Obtener las inscripciones del jugador
    const inscripciones = await this.clasificacionService['prisma'].inscripcion.findMany({
      where: {
        OR: [
          { jugador1Id: userId },
          { jugador2Id: userId },
        ],
        estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
      },
    });

    const estados = await Promise.all(
      inscripciones.map(i => this.clasificacionService.obtenerEstadoInscripcion(i.id)),
    );

    return {
      success: true,
      data: estados.filter(Boolean),
    };
  }

  /**
   * GET /jugador/inscripcion/:id/clasificacion
   * Obtiene el estado de clasificación de una inscripción específica
   */
  @Get('jugador/inscripcion/:id/clasificacion')
  @UseGuards(JwtAuthGuard)
  async getClasificacionInscripcion(@Param('id') inscripcionId: string) {
    const estado = await this.clasificacionService.obtenerEstadoInscripcion(inscripcionId);
    
    return {
      success: !!estado,
      data: estado,
    };
  }

  /**
   * GET /admin/torneos/:tournamentId/categorias/:categoryId/clasificacion
   * Obtiene el estado de clasificación de todas las inscripciones de una categoría
   */
  @Get('admin/torneos/:tournamentId/categorias/:categoryId/clasificacion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador')
  async getClasificacionCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    const estados = await this.clasificacionService.obtenerEstadosCategoria(
      tournamentId,
      categoryId,
    );

    return {
      success: true,
      data: estados,
    };
  }

  /**
   * POST /admin/torneos/:tournamentId/categorias/:categoryId/clasificacion/recalcular
   * Fuerza el recálculo de estados (útil para casos edge o correcciones)
   */
  @Get('admin/torneos/:tournamentId/categorias/:categoryId/clasificacion/recalcular')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador')
  async recalcularClasificacion(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    await this.clasificacionService.recalcularEstados(tournamentId, categoryId);

    const estados = await this.clasificacionService.obtenerEstadosCategoria(
      tournamentId,
      categoryId,
    );

    return {
      success: true,
      message: 'Estados recalculados correctamente',
      data: estados,
    };
  }
}
