import { Controller, Get, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { ClasificacionService } from './clasificacion.service';
import { ReaccionesFeedService } from './reacciones-feed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from 'express';

@Controller()
export class ClasificacionController {
  constructor(
    private readonly clasificacionService: ClasificacionService,
    private readonly reaccionesService: ReaccionesFeedService,
  ) {}

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
   * GET /jugador/mi-agenda
   * Agenda proyectada del jugador logueado (próximo partido + camino si gana + repechaje).
   */
  @Get('jugador/mi-agenda')
  @UseGuards(JwtAuthGuard)
  async getMiAgenda(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const agendas = await this.clasificacionService.obtenerAgendaJugador(userId);
    return { success: true, data: agendas };
  }

  /**
   * GET /jugador/feed
   * Feed social del jugador: actividad de su mundo de pádel (resultados de su
   * categoría + torneos nuevos en su ciudad + inscripciones de quienes sigue).
   */
  @Get('jugador/feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const feed = await this.clasificacionService.obtenerFeedJugador(userId);
    return { success: true, data: feed };
  }

  /**
   * GET /jugador/inicio
   * "Tu actividad": avisos de la plataforma hacia el jugador (lo tuyo).
   */
  @Get('jugador/inicio')
  @UseGuards(JwtAuthGuard)
  async getInicio(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const items = await this.clasificacionService.obtenerInicioJugador(userId);
    return { success: true, data: items };
  }

  /**
   * GET /comunidad/feed
   * Feed social: posts + inscripciones de seguidos + resultados de tu categoría.
   */
  @Get('comunidad/feed')
  @UseGuards(JwtAuthGuard)
  async getFeedComunidad(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const feed = await this.clasificacionService.obtenerFeedComunidad(userId);
    return { success: true, data: feed };
  }

  /**
   * POST /jugador/feed/:feedItemId/reaccion
   * "Me gusta" a una publicación del feed (idempotente).
   */
  @Post('jugador/feed/:feedItemId/reaccion')
  @UseGuards(JwtAuthGuard)
  async reaccionar(@Param('feedItemId') feedItemId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.reaccionesService.reaccionar(userId, feedItemId);
    return { success: true, data };
  }

  /**
   * DELETE /jugador/feed/:feedItemId/reaccion
   * Quita el "me gusta".
   */
  @Delete('jugador/feed/:feedItemId/reaccion')
  @UseGuards(JwtAuthGuard)
  async quitarReaccion(@Param('feedItemId') feedItemId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.reaccionesService.quitarReaccion(userId, feedItemId);
    return { success: true, data };
  }

  /**
   * GET /jugador/feed/:feedItemId/reacciones
   * Lista quién reaccionó. PRIVADO: solo el dueño de la publicación (si no, 403).
   */
  @Get('jugador/feed/:feedItemId/reacciones')
  @UseGuards(JwtAuthGuard)
  async listarReaccionadores(@Param('feedItemId') feedItemId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    const data = await this.reaccionesService.listarReaccionadores(feedItemId, userId);
    return { success: true, data };
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
