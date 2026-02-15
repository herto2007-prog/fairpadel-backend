import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  create(@Body() createTournamentDto: CreateTournamentDto, @Request() req) {
    return this.tournamentsService.create(createTournamentDto, req.user.id);
  }

  @Get()
  findAll(
    @Query('pais') pais?: string,
    @Query('ciudad') ciudad?: string,
    @Query('estado') estado?: string,
    @Query('nombre') nombre?: string,
  ) {
    return this.tournamentsService.findAll({ pais, ciudad, estado, nombre });
  }

  @Get('categories')
  obtenerCategorias() {
    return this.tournamentsService.obtenerCategorias();
  }

  @Get('my-tournaments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  findMyTournaments(@Request() req) {
    return this.tournamentsService.findMyTournaments(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
    @Request() req,
  ) {
    return this.tournamentsService.update(id, updateTournamentDto, req.user.id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  publish(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.publish(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  remove(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.remove(id, req.user.id);
  }

  @Post(':id/finalizar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  finalizarTorneo(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.finalizarTorneo(id, req.user.id);
  }

  @Put(':id/cancelar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  cancelarTorneo(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Request() req,
  ) {
    return this.tournamentsService.cancelarTorneo(id, req.user.id, body.motivo);
  }

  @Patch(':id/categorias/:tournamentCategoryId/toggle-inscripcion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  toggleInscripcionCategoria(
    @Param('id') id: string,
    @Param('tournamentCategoryId') tournamentCategoryId: string,
    @Request() req,
  ) {
    return this.tournamentsService.toggleInscripcionCategoria(id, tournamentCategoryId, req.user.id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getStats(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getStats(id, req.user.id);
  }

  @Get(':id/pelotas-ronda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getPelotasRonda(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getPelotasRonda(id, req.user.id);
  }

  @Put(':id/pelotas-ronda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  updatePelotasRonda(
    @Param('id') id: string,
    @Body() data: { rondas: { ronda: string; cantidadPelotas: number }[] },
    @Request() req,
  ) {
    return this.tournamentsService.updatePelotasRonda(id, data.rondas, req.user.id);
  }

  // ═══════════════════════════════════════════
  // AYUDANTES
  // ═══════════════════════════════════════════

  @Get(':id/ayudantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getAyudantes(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getAyudantes(id, req.user.id);
  }

  @Post(':id/ayudantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  addAyudante(
    @Param('id') id: string,
    @Body() data: { documento: string; nombre?: string; rol?: string },
    @Request() req,
  ) {
    return this.tournamentsService.addAyudante(id, data, req.user.id);
  }

  @Delete(':id/ayudantes/:ayudanteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  removeAyudante(
    @Param('id') id: string,
    @Param('ayudanteId') ayudanteId: string,
    @Request() req,
  ) {
    return this.tournamentsService.removeAyudante(id, ayudanteId, req.user.id);
  }

  // ═══════════════════════════════════════════
  // CUENTAS BANCARIAS
  // ═══════════════════════════════════════════

  @Get(':id/cuentas-bancarias')
  getCuentasBancarias(@Param('id') id: string) {
    return this.tournamentsService.getCuentasBancarias(id);
  }

  @Post(':id/cuentas-bancarias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  createCuentaBancaria(
    @Param('id') id: string,
    @Body() data: {
      banco: string;
      titular: string;
      cedulaRuc: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
    },
    @Request() req,
  ) {
    return this.tournamentsService.createCuentaBancaria(id, data, req.user.id);
  }

  @Put(':id/cuentas-bancarias/:cuentaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  updateCuentaBancaria(
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Body() data: {
      banco?: string;
      titular?: string;
      cedulaRuc?: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
      activa?: boolean;
    },
    @Request() req,
  ) {
    return this.tournamentsService.updateCuentaBancaria(id, cuentaId, data, req.user.id);
  }

  @Delete(':id/cuentas-bancarias/:cuentaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  deleteCuentaBancaria(
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Request() req,
  ) {
    return this.tournamentsService.deleteCuentaBancaria(id, cuentaId, req.user.id);
  }
}