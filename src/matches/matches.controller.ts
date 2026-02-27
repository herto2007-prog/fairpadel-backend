import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { FixtureService } from './fixture.service';
import { CargarResultadoDto } from './dto/cargar-resultado.dto';
import { SortearCategoriaDto } from './dto/sortear-categoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TournamentRoleGuard } from '../auth/guards/tournament-role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly fixtureService: FixtureService,
  ) {}

  // ── Public endpoints (no auth required) ──────────────────

  @Get('torneo/:tournamentId/fixture')
  obtenerFixture(
    @Param('tournamentId') tournamentId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.fixtureService.obtenerFixturePublico(tournamentId, categoryId);
  }

  // ── Protected endpoints (owner/admin/ayudante via TournamentRoleGuard) ──

  @Get('torneo/:tournamentId/fixture-interno')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  obtenerFixtureInterno(
    @Param('tournamentId') tournamentId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.fixtureService.obtenerFixture(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/sortear')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  sortearCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: SortearCategoriaDto,
    @Request() req,
  ) {
    return this.fixtureService.sortearCategoria(tournamentId, categoryId, req.user.id, dto.fechaInicio);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/publicar-fixture')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  publicarFixture(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.fixtureService.publicarFixture(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/generar-fixture')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  generarFixture(@Param('tournamentId') tournamentId: string) {
    return this.fixtureService.generarFixtureCompleto(tournamentId);
  }

  @Post('swap-schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  swapSchedules(
    @Body() body: { match1Id: string; match2Id: string },
    @Request() req,
  ) {
    return this.matchesService.swapMatchSchedules(
      body.match1Id,
      body.match2Id,
      req.user.id,
    );
  }

  @Get('torneo/:tournamentId/categoria/:categoryId/standings')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  obtenerStandings(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.matchesService.obtenerStandings(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/finalizar')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  finalizarCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.matchesService.finalizarCategoria(tournamentId, categoryId);
  }

  @Get('torneo/:tournamentId/pendientes')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  obtenerPendientes(@Param('tournamentId') tournamentId: string) {
    return this.matchesService.obtenerPartidosPendientes(tournamentId);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/reagendar-sin-cancha')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  reagendarSinCancha(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.matchesService.reagendarSinCancha(tournamentId, categoryId);
  }

  // ── Generic :id endpoints (must be LAST to avoid catching specific routes) ──

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Put(':id/cargar-resultado')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  cargarResultado(
    @Param('id') id: string,
    @Body() dto: CargarResultadoDto,
  ) {
    return this.matchesService.cargarResultado(id, dto);
  }

  @Put(':id/editar-resultado')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  editarResultado(
    @Param('id') id: string,
    @Body() dto: CargarResultadoDto,
  ) {
    return this.matchesService.editarResultado(id, dto);
  }

  @Put(':id/reprogramar')
  @UseGuards(JwtAuthGuard, TournamentRoleGuard)
  reprogramar(
    @Param('id') id: string,
    @Body() body: { fechaProgramada: string; horaProgramada: string; torneoCanchaId?: string },
    @Request() req,
  ) {
    return this.matchesService.reprogramar(id, body, req.user.id);
  }
}
