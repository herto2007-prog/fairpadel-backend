import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseArrayPipe,
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
  // CRUD DE SEDES (Solo admin)
  // ═══════════════════════════════════════════════════════

  /**
   * Crear una nueva sede (Solo admin)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createSede(@Body() createSedeDto: CreateSedeDto) {
    return this.sedesService.createSede(createSedeDto);
  }

  /**
   * Obtener todas las sedes (publico - para que organizadores puedan seleccionar)
   */
  @Get()
  async findAllSedes(
    @Query('ciudad') ciudad?: string,
    @Query('activo') activo?: string,
    @Query('nombre') nombre?: string,
  ) {
    return this.sedesService.findAllSedes({
      ciudad,
      nombre,
      activo: activo === 'true' ? true : activo === 'false' ? false : undefined,
    });
  }

  /**
   * Obtener una sede por ID con sus canchas
   */
  @Get(':id')
  async findOneSede(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.findOneSede(id);
  }

  /**
   * Actualizar una sede (Solo admin)
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateSede(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSedeDto: UpdateSedeDto,
  ) {
    return this.sedesService.updateSede(id, updateSedeDto);
  }

  /**
   * Desactivar una sede (Solo admin) - soft delete
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSede(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.deleteSede(id);
  }

  /**
   * Reactivar una sede desactivada (Solo admin)
   */
  @Put(':id/reactivar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async reactivarSede(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.reactivarSede(id);
  }

  // ═══════════════════════════════════════════════════════
  // CRUD DE CANCHAS DENTRO DE UNA SEDE (Solo admin)
  // ═══════════════════════════════════════════════════════

  /**
   * Agregar una cancha a una sede (Solo admin)
   */
  @Post(':sedeId/canchas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createCancha(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Body() createCanchaDto: CreateSedeCanchaDto,
  ) {
    return this.sedesService.createCancha(sedeId, createCanchaDto);
  }

  /**
   * Obtener todas las canchas de una sede
   */
  @Get(':sedeId/canchas')
  async findAllCanchas(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.sedesService.findAllCanchas(sedeId, includeInactive === 'true');
  }

  /**
   * Actualizar una cancha (Solo admin)
   */
  @Put(':sedeId/canchas/:canchaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCancha(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Body() updateCanchaDto: UpdateSedeCanchaDto,
  ) {
    return this.sedesService.updateCancha(sedeId, canchaId, updateCanchaDto);
  }

  /**
   * Desactivar una cancha (Solo admin) - soft delete
   */
  @Delete(':sedeId/canchas/:canchaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCancha(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
  ) {
    return this.sedesService.deleteCancha(sedeId, canchaId);
  }

  /**
   * Actualizar multiples canchas a la vez (posiciones en el canvas)
   * Util para cuando el admin arrastra las canchas en el plano visual
   */
  @Put(':sedeId/canchas-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCanchasBulk(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Body(new ParseArrayPipe({ items: UpdateSedeCanchaDto }))
    canchas: UpdateSedeCanchaDto[],
  ) {
    return this.sedesService.updateCanchasBulk(sedeId, canchas);
  }

  // ═══════════════════════════════════════════════════════
  // CONFIGURACION DE CANCHAS PARA TORNEOS (Organizadores)
  // ═══════════════════════════════════════════════════════

  /**
   * Configurar las canchas y horarios para un torneo
   * Solo organizador dueno del torneo o admin
   */
  @Post('torneos/:tournamentId/configurar-canchas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async configurarTorneoCanchas(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: ConfigurarTorneoCanchasDto,
    @Req() req: any,
  ) {
    return this.sedesService.configurarTorneoCanchas(
      tournamentId,
      dto,
      req.user.id,
      req.user.roles || [],
    );
  }

  /**
   * Obtener la configuracion de canchas de un torneo
   */
  @Get('torneos/:tournamentId/canchas')
  async getTorneoCanchas(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.sedesService.getTorneoCanchas(tournamentId);
  }

  /**
   * Agregar una sede adicional a un torneo
   * Solo organizador dueno del torneo o admin
   */
  @Post('torneos/:tournamentId/sedes/:sedeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async agregarSedeATorneo(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Req() req: any,
  ) {
    return this.sedesService.agregarSedeATorneo(
      tournamentId,
      sedeId,
      req.user.id,
      req.user.roles || [],
    );
  }

  /**
   * Remover una sede adicional de un torneo
   * Solo organizador dueno del torneo o admin
   */
  @Delete('torneos/:tournamentId/sedes/:sedeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerSedeDeTorneo(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @Req() req: any,
  ) {
    return this.sedesService.removerSedeDeTorneo(
      tournamentId,
      sedeId,
      req.user.id,
      req.user.roles || [],
    );
  }

  /**
   * Obtener todas las sedes vinculadas a un torneo (principal + adicionales)
   */
  @Get('torneos/:tournamentId/sedes')
  async getSedesDeTorneo(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.sedesService.getSedesDeTorneo(tournamentId);
  }
}
