import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CircuitosService } from './circuitos.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('circuitos')
export class CircuitosController {
  constructor(private readonly circuitosService: CircuitosService) {}

  // ============ ENDPOINTS ADMIN (rutas estáticas primero) ============

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateCircuitoDto) {
    return this.circuitosService.create(dto);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin(
    @Query('estado') estado?: string,
    @Query('pais') pais?: string,
  ) {
    return this.circuitosService.findAll({ estado, pais });
  }

  @Get('admin/torneos-disponibles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getTorneosDisponibles() {
    return this.circuitosService.getTorneosDisponibles();
  }

  // ============ ENDPOINTS PÚBLICOS ============

  @Get()
  findAllActive() {
    return this.circuitosService.findAllActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.circuitosService.findOne(id);
  }

  @Get(':id/standings')
  getStandings(
    @Param('id') id: string,
    @Query('genero') genero?: string,
  ) {
    return this.circuitosService.getStandings(id, genero);
  }

  // ============ ENDPOINTS ADMIN (rutas con :id) ============

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateCircuitoDto) {
    return this.circuitosService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.circuitosService.remove(id);
  }

  @Put(':id/agregar-torneo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  agregarTorneo(
    @Param('id') id: string,
    @Body() body: { tournamentId: string },
  ) {
    return this.circuitosService.agregarTorneo(id, body.tournamentId);
  }

  @Put(':id/remover-torneo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removerTorneo(
    @Param('id') id: string,
    @Body() body: { tournamentId: string },
  ) {
    return this.circuitosService.removerTorneo(id, body.tournamentId);
  }

  @Put(':id/finalizar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  finalizar(@Param('id') id: string) {
    return this.circuitosService.finalizar(id);
  }
}
