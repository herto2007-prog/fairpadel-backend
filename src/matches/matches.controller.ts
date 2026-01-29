import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { FixtureService } from './fixture.service';
import { CargarResultadoDto } from './dto/cargar-resultado.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly fixtureService: FixtureService,
  ) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Put(':id/cargar-resultado')
  @Roles('organizador', 'admin')
  @UseGuards(RolesGuard)
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
    @Body() body: { fechaProgramada: string; horaProgramada: string; canchaId?: string },
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