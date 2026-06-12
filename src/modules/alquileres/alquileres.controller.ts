import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AlquileresService } from './alquileres.service';
import { CreateAlquilerConfigDto } from './dto/create-alquiler-config.dto';
import { CreateReservaDto, ConfirmarReservaDto, CancelarReservaDto } from './dto/create-reserva.dto';
import { CreateDisponibilidadDto, UpdateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { CreateBloqueoDto, UpdateBloqueoDto } from './dto/create-bloqueo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SedeGestionGuard } from '../../common/guards/sede-gestion.guard';

// Gestión de sede (config, disponibilidades, bloqueos, aprobar/rechazar
// reservas, estadísticas): SedeGestionGuard = dueño/encargado de ESA sede o
// admin. Antes solo se exigía rol global (admin/organizador/encargado), lo
// que permitía operar sobre sedes ajenas (IDOR).
@Controller('alquileres')
export class AlquileresController {
  constructor(private readonly alquileresService: AlquileresService) {}

  // ============ CONFIGURACIÓN ============

  @Post('config')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
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

  // ============ GESTIÓN DE DISPONIBILIDADES (DUEÑO/ENCARGADO) ============

  @Get('sede/:sedeId/disponibilidades')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  obtenerDisponibilidadesSede(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerDisponibilidadesSede(sedeId);
  }

  @Post('disponibilidades')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  crearDisponibilidad(@Body() createDto: CreateDisponibilidadDto) {
    return this.alquileresService.crearDisponibilidad(createDto);
  }

  @Put('disponibilidades/:disponibilidadId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  actualizarDisponibilidad(
    @Param('disponibilidadId') id: string,
    @Body() updateDto: UpdateDisponibilidadDto,
  ) {
    return this.alquileresService.actualizarDisponibilidad(id, updateDto);
  }

  @Delete('disponibilidades/:disponibilidadId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  eliminarDisponibilidad(@Param('disponibilidadId') id: string) {
    return this.alquileresService.eliminarDisponibilidad(id);
  }

  // ============ GESTIÓN DE BLOQUEOS (DUEÑO/ENCARGADO) ============

  @Get('sede/:sedeId/bloqueos')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  obtenerBloqueosSede(
    @Param('sedeId') sedeId: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.alquileresService.obtenerBloqueosSede(sedeId, fechaDesde, fechaHasta);
  }

  @Post('bloqueos')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  crearBloqueo(@Body() createDto: CreateBloqueoDto) {
    return this.alquileresService.crearBloqueo(createDto);
  }

  @Put('bloqueos/:bloqueoId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  actualizarBloqueo(
    @Param('bloqueoId') id: string,
    @Body() updateDto: UpdateBloqueoDto,
  ) {
    return this.alquileresService.actualizarBloqueo(id, updateDto);
  }

  @Delete('bloqueos/:bloqueoId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  eliminarBloqueo(@Param('bloqueoId') id: string) {
    return this.alquileresService.eliminarBloqueo(id);
  }

  // ============ RESERVAS PÚBLICAS ============

  @Post('reservas')
  @UseGuards(JwtAuthGuard)
  crearReserva(@Body() createDto: CreateReservaDto, @Request() req) {
    // El JWT guarda el userId como 'sub' o 'userId', no como 'id'
    const userId = req.user?.userId || req.user?.sub || null;
    console.log(`[DEBUG Controller] crearReserva - userId: ${userId}`);
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

  // ============ GESTIÓN DUEÑO/ENCARGADO ============

  @Get('sede/:sedeId/reservas')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  obtenerReservasSede(
    @Param('sedeId') sedeId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.alquileresService.obtenerReservasSede(sedeId, fecha);
  }

  @Post('reservas/:reservaId/aprobar')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  aprobarReserva(@Param('reservaId') reservaId: string) {
    return this.alquileresService.aprobarReserva(reservaId);
  }

  @Post('reservas/:reservaId/rechazar')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  rechazarReserva(
    @Param('reservaId') reservaId: string,
    @Body('motivo') motivo?: string,
  ) {
    return this.alquileresService.rechazarReserva(reservaId, motivo);
  }

  // ============ ESTADÍSTICAS ============

  @Get('sede/:sedeId/estadisticas')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  obtenerEstadisticas(
    @Param('sedeId') sedeId: string,
    @Query('mes') mes?: string, // Formato: YYYY-MM
  ) {
    return this.alquileresService.obtenerEstadisticas(sedeId, mes);
  }
}
