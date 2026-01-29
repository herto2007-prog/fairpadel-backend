import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get()
  obtenerRankings(
    @Query('tipo') tipo?: string,
    @Query('alcance') alcance?: string,
    @Query('genero') genero?: string,
  ) {
    return this.rankingsService.obtenerRankings(tipo, alcance, genero);
  }

  @Get('global')
  obtenerRankingGlobal(@Query('genero') genero?: string) {
    return this.rankingsService.obtenerRankingGlobal(genero);
  }

  @Get('pais/:pais')
  obtenerRankingPorPais(
    @Param('pais') pais: string,
    @Query('genero') genero?: string,
  ) {
    return this.rankingsService.obtenerRankingPorPais(pais, genero);
  }

  @Get('ciudad/:ciudad')
  obtenerRankingPorCiudad(
    @Param('ciudad') ciudad: string,
    @Query('genero') genero?: string,
  ) {
    return this.rankingsService.obtenerRankingPorCiudad(ciudad, genero);
  }

  @Get('categoria/:categoria')
  obtenerRankingPorCategoria(
    @Param('categoria') categoria: string,
    @Query('genero') genero?: string,
  ) {
    return this.rankingsService.obtenerRankingPorCategoria(categoria, genero);
  }

  @Get('top10')
  obtenerTop10(@Query('genero') genero?: string) {
    return this.rankingsService.obtenerTop10(genero);
  }

  @Get('jugador/:jugadorId')
  @UseGuards(JwtAuthGuard)
  obtenerRankingJugador(@Param('jugadorId') jugadorId: string) {
    return this.rankingsService.obtenerRankingJugador(jugadorId);
  }

  @Get('jugador/:jugadorId/historial')
  @UseGuards(JwtAuthGuard)
  obtenerHistorialPuntos(@Param('jugadorId') jugadorId: string) {
    return this.rankingsService.obtenerHistorialPuntos(jugadorId);
  }
}