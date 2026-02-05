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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SedesService } from './sedes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateSedeCanchaDto } from './dto/create-sede-cancha.dto';
import { UpdateSedeCanchaDto } from './dto/update-sede-cancha.dto';
import { ConfigurarTorneoCanchasDto } from './dto/configurar-torneo-canchas.dto';

@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  // ═══════════════════════════════════════════════════════
  // CRUD DE SEDES (Solo ADMIN)
  // ═══════════════════════════════════════════════════════

  /**
   * Crear una nueva sede (Solo ADMIN)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createSede(@Body() createSedeDto: CreateSedeDto) {
    return this.sedesService.createSede(createSedeDto);
  }

  /**
   * Obtener todas las sedes (público - para que organizadores puedan seleccionar)
   */
  @Get()
  async findAllSedes(
    @Query('ciudad') ciudad?: string,
    @Query('activo') activo?: string,
  ) {
    return this.sedesService.findAllSedes({
      ciudad,
      activo: activo === 'true' ? true : activo === 'false' ? false : undefined,
    });
  }

  /**
   * Obtener una sede por ID con sus canchas
   */
  @Get(':id')
  async findOneSede(@Param('id') id: string) {
    return this.sedesService.findOneSede(id);
  }

  /**
   * Actualizar una sede (Solo ADMIN)
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateSede(
    @Param('id') id: string,
    @Body() updateSedeDto: UpdateSedeDto,
  ) {
    return this.sedesService.updateSede(id, updateSedeDto);
  }

  /**
   * Eliminar una sede (Solo ADMIN)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSede(@Param('id') id: string) {
    return this.sedesService.deleteSede(id);
  }

  // ═══════════════════════════════════════════════════════
  // CRUD DE CANCHAS DENTRO DE UNA SEDE (Solo ADMIN)
  // ═══════════════════════════════════════════════════════

  /**
   * Agregar una cancha a una sede (Solo ADMIN)
   */
  @Post(':sedeId/canchas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createCancha(
    @Param('sedeId') sedeId: string,
    @Body() createCanchaDto: CreateSedeCanchaDto,
  ) {
    return this.sedesService.createCancha(sedeId, createCanchaDto);
  }

  /**
   * Obtener todas las canchas de una sede
   */
  @Get(':sedeId/canchas')
  async findAllCanchas(@Param('sedeId') sedeId: string) {
    return this.sedesService.findAllCanchas(sedeId);
  }

  /**
   * Actualizar una cancha (Solo ADMIN)
   */
  @Put(':sedeId/canchas/:canchaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateCancha(
    @Param('sedeId') sedeId: string,
    @Param('canchaId') canchaId: string,
    @Body() updateCanchaDto: UpdateSedeCanchaDto,
  ) {
    return this.sedesService.updateCancha(sedeId, canchaId, updateCanchaDto);
  }

  /**
   * Eliminar una cancha (Solo ADMIN)
   */
  @Delete(':sedeId/canchas/:canchaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCancha(
    @Param('sedeId') sedeId: string,
    @Param('canchaId') canchaId: string,
  ) {
    return this.sedesService.deleteCancha(sedeId, canchaId);
  }

  /**
   * Actualizar múltiples canchas a la vez (posiciones en el canvas)
   * Útil para cuando el admin arrastra las canchas en el plano visual
   */
  @Put(':sedeId/canchas-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateCanchasBulk(
    @Param('sedeId') sedeId: string,
    @Body() canchas: UpdateSedeCanchaDto[],
  ) {
    return this.sedesService.updateCanchasBulk(sedeId, canchas);
  }

  // ═══════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CANCHAS PARA TORNEOS (Organizadores)
  // ═══════════════════════════════════════════════════════

  /**
   * Configurar las canchas y horarios para un torneo
   * Esto vincula las canchas de una sede al torneo con sus horarios
   */
  @Post('torneos/:tournamentId/configurar-canchas')
  @UseGuards(JwtAuthGuard)
  async configurarTorneoCanchas(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: ConfigurarTorneoCanchasDto,
  ) {
    return this.sedesService.configurarTorneoCanchas(tournamentId, dto);
  }

  /**
   * Obtener la configuración de canchas de un torneo
   */
  @Get('torneos/:tournamentId/canchas')
  async getTorneoCanchas(@Param('tournamentId') tournamentId: string) {
    return this.sedesService.getTorneoCanchas(tournamentId);
  }

  /**
   * Agregar una sede adicional a un torneo
   */
  @Post('torneos/:tournamentId/sedes/:sedeId')
  @UseGuards(JwtAuthGuard)
  async agregarSedeATorneo(
    @Param('tournamentId') tournamentId: string,
    @Param('sedeId') sedeId: string,
  ) {
    return this.sedesService.agregarSedeATorneo(tournamentId, sedeId);
  }

  /**
   * Remover una sede adicional de un torneo
   */
  @Delete('torneos/:tournamentId/sedes/:sedeId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerSedeDeTorneo(
    @Param('tournamentId') tournamentId: string,
    @Param('sedeId') sedeId: string,
  ) {
    return this.sedesService.removerSedeDeTorneo(tournamentId, sedeId);
  }

  /**
   * Obtener todas las sedes vinculadas a un torneo (principal + adicionales)
   */
  @Get('torneos/:tournamentId/sedes')
  async getSedesDeTorneo(@Param('tournamentId') tournamentId: string) {
    return this.sedesService.getSedesDeTorneo(tournamentId);
  }
}
