import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { SeguimientoService } from '../services/seguimiento.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * "Seguir una pareja" en un torneo (para alentarla / ver su camino en el cuadro).
 * Distinto a la conexión social (ver SeguimientoController): no afecta tus
 * seguidores/seguidos del Inicio.
 */
@Controller()
export class SeguimientoParejaController {
  constructor(private readonly seguimientoService: SeguimientoService) {}

  /** POST /jugador/parejas/:inscripcionId/seguir */
  @Post('jugador/parejas/:inscripcionId/seguir')
  @UseGuards(JwtAuthGuard)
  async seguir(@Param('inscripcionId') inscripcionId: string, @Request() req: any) {
    return this.seguimientoService.seguirPareja(req.user.userId, inscripcionId);
  }

  /** DELETE /jugador/parejas/:inscripcionId/seguir */
  @Delete('jugador/parejas/:inscripcionId/seguir')
  @UseGuards(JwtAuthGuard)
  async dejar(@Param('inscripcionId') inscripcionId: string, @Request() req: any) {
    return this.seguimientoService.dejarDeSeguirPareja(req.user.userId, inscripcionId);
  }

  /** GET /jugador/torneos/:tournamentId/parejas-seguidas */
  @Get('jugador/torneos/:tournamentId/parejas-seguidas')
  @UseGuards(JwtAuthGuard)
  async lista(@Param('tournamentId') tournamentId: string, @Request() req: any) {
    const data = await this.seguimientoService.parejasSeguidasEnTorneo(req.user.userId, tournamentId);
    return { success: true, data };
  }
}
