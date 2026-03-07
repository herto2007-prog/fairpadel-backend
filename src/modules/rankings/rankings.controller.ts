import { Controller, Get, Param, Query, Post, Body, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('global')
  getRankingGlobal(@Query('temporada') temporada?: string) {
    return this.rankingsService.getRankingGlobal(temporada);
  }

  @Get('categoria/:categoryId')
  getRankingPorCategoria(
    @Param('categoryId') categoryId: string,
    @Query('temporada') temporada?: string,
  ) {
    return this.rankingsService.getRankingPorCategoria(categoryId, temporada);
  }

  @Get('jugador/:jugadorId')
  getRankingJugador(@Param('jugadorId') jugadorId: string) {
    return this.rankingsService.getRankingJugador(jugadorId);
  }

  @Get('estadisticas/:jugadorId')
  getEstadisticasJugador(@Param('jugadorId') jugadorId: string) {
    return this.rankingsService.getEstadisticasJugador(jugadorId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMiRanking(@GetUser() user: User) {
    return this.rankingsService.getRankingJugador(user.id);
  }

  @Get('estadisticas/me')
  @UseGuards(JwtAuthGuard)
  getMisEstadisticas(@GetUser() user: User) {
    return this.rankingsService.getEstadisticasJugador(user.id);
  }

  @Post('actualizar-torneo')
  @UseGuards(JwtAuthGuard)
  actualizarRankingsPorTorneo(
    @Body() data: { tournamentId: string; categoryId: string },
    @GetUser() user: User,
  ) {
    // TODO: Verificar que el usuario es organizador del torneo
    return this.rankingsService.actualizarRankingsPorTorneo(
      data.tournamentId,
      data.categoryId,
    );
  }
}
