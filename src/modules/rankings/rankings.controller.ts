import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { QueryRankingsDto } from './dto/query-rankings.dto';
import { CreateConfigPuntosDto, UpdateConfigPuntosDto } from './dto/create-config-puntos.dto';
import { CreateReglaAscensoDto, UpdateReglaAscensoDto } from './dto/create-regla-ascenso.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request } from '@nestjs/common';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  // ═══════════════════════════════════════════════════════════
  // RUTAS PÚBLICAS
  // ═══════════════════════════════════════════════════════════

  @Get()
  async getRankings(@Query() query: QueryRankingsDto) {
    return this.rankingsService.getRankings(query);
  }

  @Get('jugador/:jugadorId')
  async getRankingJugador(@Param('jugadorId') jugadorId: string) {
    return this.rankingsService.getRankingJugador(jugadorId);
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE PUNTOS (Admin)
  // ═══════════════════════════════════════════════════════════

  @Get('admin/config-puntos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getConfigPuntos() {
    return this.rankingsService.getConfigPuntos();
  }

  @Post('admin/config-puntos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createConfigPuntos(@Body() dto: CreateConfigPuntosDto) {
    return this.rankingsService.createConfigPuntos(dto);
  }

  @Put('admin/config-puntos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateConfigPuntos(@Param('id') id: string, @Body() dto: UpdateConfigPuntosDto) {
    return this.rankingsService.updateConfigPuntos(id, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // REGLAS DE ASCENSO (Admin)
  // ═══════════════════════════════════════════════════════════

  @Get('admin/reglas-ascenso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getReglasAscenso() {
    return this.rankingsService.getReglasAscenso();
  }

  @Post('admin/reglas-ascenso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createReglaAscenso(@Body() dto: CreateReglaAscensoDto) {
    return this.rankingsService.createReglaAscenso(dto);
  }

  @Put('admin/reglas-ascenso/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateReglaAscenso(@Param('id') id: string, @Body() dto: UpdateReglaAscensoDto) {
    return this.rankingsService.updateReglaAscenso(id, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // CÁLCULO DE PUNTOS (Organizador/Admin)
  // ═══════════════════════════════════════════════════════════

  @Post('admin/calcular/:tournamentId/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador')
  async calcularPuntos(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.rankingsService.calcularPuntosTorneo(tournamentId, categoryId);
  }

  // ═══════════════════════════════════════════════════════════
  // ASCENSOS PENDIENTES (Admin)
  // ═══════════════════════════════════════════════════════════

  @Get('admin/ascensos-pendientes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAscensosPendientes() {
    return this.rankingsService.getAscensosPendientes();
  }

  @Post('admin/ascensos-calcular')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async calcularAscensos() {
    return this.rankingsService.calcularAscensosPendientes();
  }

  @Post('admin/ascensos-procesar/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async procesarAscenso(
    @Param('id') id: string,
    @Body() body: { estado: 'CONFIRMADO' | 'RECHAZADO'; notas?: string },
    @Request() req: any,
  ) {
    return this.rankingsService.procesarAscenso(id, body.estado, req.user.userId, body.notas);
  }
}
