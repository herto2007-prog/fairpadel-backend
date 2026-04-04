import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AlquileresService } from './alquileres.service';
import { CreateAlquilerConfigDto } from './dto/create-alquiler-config.dto';
import { CreateReservaDto, ConfirmarReservaDto, CancelarReservaDto } from './dto/create-reserva.dto';
import { CreateDisponibilidadDto, UpdateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { CreateBloqueoDto, UpdateBloqueoDto } from './dto/create-bloqueo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('alquileres')
export class AlquileresController {
  constructor(private readonly alquileresService: AlquileresService) {}

  // ============ CONFIGURACIÓN ============

  @Post('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  crearConfig(@Body() createDto: CreateAlquilerConfigDto) {
    return this.alquileresService.crearConfig(createDto);
  }

  @Get('config/:sedeId')
  obtenerConfig(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerConfig(sedeId);
  }

  // ============ DISPONIBILIDAD ============

  @Get('disponibilidad')
  consultarDisponibilidad(
    @Query('sedeId') sedeId: string,
    @Query('fecha') fecha: string,
    @Query('canchaId') canchaId?: string,
    @Query('duracionMinutos') duracionMinutos?: string,
  ) {
    return this.alquileresService.consultarDisponibilidad(
      sedeId, 
      fecha, 
      canchaId, 
      duracionMinutos ? parseInt(duracionMinutos, 10) : undefined
    );
  }

  /**
   * GET /alquileres/disponibilidad-global
   * Devuelve disponibilidad de TODAS las sedes para una fecha y duración
   * Similar a deportes42 - vista unificada
   */
  @Get('disponibilidad-global')
  consultarDisponibilidadGlobal(
    @Query('fecha') fecha: string,
    @Query('duracionMinutos') duracionMinutos?: string,
    @Query('horaDesde') horaDesde?: string,
    @Query('horaHasta') horaHasta?: string,
  ) {
    // Validar formato de fecha YYYY-MM-DD
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('Fecha inválida. Formato requerido: YYYY-MM-DD');
    }

    return this.alquileresService.consultarDisponibilidadGlobal({
      fecha,
      duracionMinutos: duracionMinutos ? parseInt(duracionMinutos, 10) : 90,
      horaDesde,
      horaHasta,
    });
  }

  // ============ GESTIÓN DE DISPONIBILIDADES (ENCARGADO) ============

  @Get('sede/:sedeId/disponibilidades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  obtenerDisponibilidadesSede(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerDisponibilidadesSede(sedeId);
  }

  @Post('disponibilidades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  crearDisponibilidad(@Body() createDto: CreateDisponibilidadDto) {
    return this.alquileresService.crearDisponibilidad(createDto);
  }

  @Put('disponibilidades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  actualizarDisponibilidad(
    @Param('id') id: string,
    @Body() updateDto: UpdateDisponibilidadDto,
  ) {
    return this.alquileresService.actualizarDisponibilidad(id, updateDto);
  }

  @Delete('disponibilidades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  eliminarDisponibilidad(@Param('id') id: string) {
    return this.alquileresService.eliminarDisponibilidad(id);
  }

  // ============ GESTIÓN DE BLOQUEOS (ENCARGADO) ============

  @Get('sede/:sedeId/bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  obtenerBloqueosSede(
    @Param('sedeId') sedeId: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.alquileresService.obtenerBloqueosSede(sedeId, fechaDesde, fechaHasta);
  }

  @Post('bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  crearBloqueo(@Body() createDto: CreateBloqueoDto) {
    return this.alquileresService.crearBloqueo(createDto);
  }

  @Put('bloqueos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  actualizarBloqueo(
    @Param('id') id: string,
    @Body() updateDto: UpdateBloqueoDto,
  ) {
    return this.alquileresService.actualizarBloqueo(id, updateDto);
  }

  @Delete('bloqueos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  eliminarBloqueo(@Param('id') id: string) {
    return this.alquileresService.eliminarBloqueo(id);
  }

  // ============ RESERVAS PÚBLICAS ============

  @Post('reservas')
  @UseGuards(JwtAuthGuard)
  crearReserva(@Body() createDto: CreateReservaDto, @Request() req) {
    console.log(`[DEBUG Controller] crearReserva - req.user:`, req.user);
    console.log(`[DEBUG Controller] crearReserva - headers:`, req.headers);
    const userId = req.user?.id || null;
    console.log(`[DEBUG Controller] crearReserva - userId extraido: ${userId}`);
    return this.alquileresService.crearReserva(userId, createDto);
  }

  // ============ RESERVAS AUTENTICADAS ============

  @Get('mis-reservas')
  @UseGuards(JwtAuthGuard)
  obtenerMisReservas(@Request() req) {
    return this.alquileresService.obtenerMisReservas(req.user.id);
  }

  @Post('reservas/:id/confirmar')
  @UseGuards(JwtAuthGuard)
  confirmarReserva(
    @Param('id') reservaId: string,
    @Body() confirmarDto: ConfirmarReservaDto,
    @Request() req,
  ) {
    return this.alquileresService.confirmarReserva(reservaId, confirmarDto, req.user.id);
  }

  @Post('reservas/:id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelarReserva(
    @Param('id') reservaId: string,
    @Body() cancelarDto: CancelarReservaDto,
    @Request() req,
  ) {
    return this.alquileresService.cancelarReserva(reservaId, cancelarDto, req.user.id);
  }

  // ============ GESTIÓN ENCARGADO ============

  @Get('sede/:sedeId/reservas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  obtenerReservasSede(
    @Param('sedeId') sedeId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.alquileresService.obtenerReservasSede(sedeId, fecha);
  }

  @Post('reservas/:id/aprobar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  aprobarReserva(@Param('id') reservaId: string) {
    return this.alquileresService.aprobarReserva(reservaId);
  }

  @Post('reservas/:id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'encargado')
  rechazarReserva(
    @Param('id') reservaId: string,
    @Body('motivo') motivo?: string,
  ) {
    return this.alquileresService.rechazarReserva(reservaId, motivo);
  }
}
