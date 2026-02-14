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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TournamentRoleGuard } from '../auth/guards/tournament-role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly fixtureService: FixtureService,
  ) {}

  @Post('torneo/:tournamentId/categoria/:categoryId/sortear')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  sortearCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.fixtureService.sortearCategoria(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/publicar-fixture')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  publicarFixture(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.fixtureService.publicarFixture(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/generar-fixture')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  generarFixture(@Param('tournamentId') tournamentId: string) {
    return this.fixtureService.generarFixtureCompleto(tournamentId);
  }

  @Get('torneo/:tournamentId/fixture')
  obtenerFixture(
    @Param('tournamentId') tournamentId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.fixtureService.obtenerFixture(tournamentId, categoryId);
  }

  @Post('swap-schedules')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
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
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  obtenerStandings(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.matchesService.obtenerStandings(tournamentId, categoryId);
  }

  @Post('torneo/:tournamentId/categoria/:categoryId/finalizar')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  finalizarCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.matchesService.finalizarCategoria(tournamentId, categoryId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Put(':id/cargar-resultado')
  @UseGuards(TournamentRoleGuard)
  cargarResultado(
    @Param('id') id: string,
    @Body() dto: CargarResultadoDto,
  ) {
    return this.matchesService.cargarResultado(id, dto);
  }

  @Put(':id/reprogramar')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  reprogramar(
    @Param('id') id: string,
    @Body() body: { fechaProgramada: string; horaProgramada: string; torneoCanchaId?: string },
  ) {
    return this.matchesService.reprogramar(id, body);
  }

  @Get('torneo/:tournamentId/pendientes')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
  obtenerPendientes(@Param('tournamentId') tournamentId: string) {
    return this.matchesService.obtenerPartidosPendientes(tournamentId);
  }
}
