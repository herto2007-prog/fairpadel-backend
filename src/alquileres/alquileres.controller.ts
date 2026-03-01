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
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AlquileresService } from './alquileres.service';
import { HabilitarAlquilerDto, ActualizarAlquilerConfigDto } from './dto/alquiler-config.dto';
import { ConfigurarPreciosDto } from './dto/alquiler-precio.dto';
import { ConfigurarDisponibilidadDto } from './dto/alquiler-disponibilidad.dto';
import { CrearBloqueoAlquilerDto } from './dto/alquiler-bloqueo.dto';
import {
  CrearReservaCanchaDto,
  CrearReservaManualDto,
  RechazarReservaCanchaDto,
  MarcarPagoCanchaDto,
} from './dto/reserva-cancha.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('alquileres')
export class AlquileresController {
  constructor(private readonly alquileresService: AlquileresService) {}

  // ════════════════════════════════════════════════════════
  // USUARIO AUTENTICADO — STATIC FIRST
  // ════════════════════════════════════════════════════════

  @Get('mis-reservas')
  @UseGuards(JwtAuthGuard)
  getMisReservas(@Request() req, @Query('estado') estado?: string) {
    return this.alquileresService.obtenerMisReservas(req.user.id, estado);
  }

  @Put('mis-reservas/:id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelarReserva(@Param('id') id: string, @Request() req) {
    return this.alquileresService.cancelarReserva(id, req.user.id);
  }

  // ════════════════════════════════════════════════════════
  // ADMIN — STATIC PREFIX
  // ════════════════════════════════════════════════════════

  @Post('admin/habilitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  habilitarAlquiler(@Body() dto: HabilitarAlquilerDto) {
    return this.alquileresService.habilitarAlquiler(dto);
  }

  @Put('admin/:sedeId/deshabilitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deshabilitarAlquiler(@Param('sedeId') sedeId: string) {
    return this.alquileresService.deshabilitarAlquiler(sedeId);
  }

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getDashboard() {
    return this.alquileresService.obtenerDashboardAlquileres();
  }

  // ════════════════════════════════════════════════════════
  // ENCARGADO — STATIC PREFIX
  // ════════════════════════════════════════════════════════

  @Get('encargado/mi-sede')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado')
  getMiSede(@Request() req) {
    return this.alquileresService.obtenerMiSede(req.user.id);
  }

  @Get('encargado/:sedeId/reservas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  getReservasSede(
    @Param('sedeId') sedeId: string,
    @Request() req,
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.alquileresService.obtenerReservasSede(sedeId, req.user.id, req.user.roles, { estado, fecha });
  }

  @Put('encargado/reservas/:id/confirmar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  confirmarReserva(@Param('id') id: string, @Request() req) {
    return this.alquileresService.confirmarReserva(id, req.user.id, req.user.roles);
  }

  @Put('encargado/reservas/:id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  rechazarReserva(@Param('id') id: string, @Request() req, @Body() dto: RechazarReservaCanchaDto) {
    return this.alquileresService.rechazarReserva(id, req.user.id, req.user.roles, dto);
  }

  @Put('encargado/reservas/:id/completar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  completarReserva(@Param('id') id: string, @Request() req) {
    return this.alquileresService.completarReserva(id, req.user.id, req.user.roles);
  }

  @Put('encargado/reservas/:id/no-show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  marcarNoShow(@Param('id') id: string, @Request() req) {
    return this.alquileresService.marcarNoShow(id, req.user.id, req.user.roles);
  }

  @Put('encargado/reservas/:id/pago')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  marcarPago(@Param('id') id: string, @Request() req, @Body() dto: MarcarPagoCanchaDto) {
    return this.alquileresService.marcarPago(id, req.user.id, req.user.roles, dto);
  }

  @Post('encargado/:sedeId/reserva-manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  crearReservaManual(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: CrearReservaManualDto) {
    return this.alquileresService.crearReservaManual(sedeId, req.user.id, req.user.roles, dto);
  }

  @Get('encargado/:sedeId/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  getConfig(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerConfig(sedeId);
  }

  @Put('encargado/:sedeId/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  actualizarConfig(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: ActualizarAlquilerConfigDto) {
    return this.alquileresService.actualizarConfig(sedeId, dto, req.user.id, req.user.roles);
  }

  @Put('encargado/:sedeId/precios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  configurarPrecios(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: ConfigurarPreciosDto) {
    return this.alquileresService.configurarPrecios(sedeId, dto, req.user.id, req.user.roles);
  }

  @Get('encargado/:sedeId/precios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  getPrecios(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerPrecios(sedeId);
  }

  @Put('encargado/:sedeId/disponibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  configurarDisponibilidad(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: ConfigurarDisponibilidadDto) {
    return this.alquileresService.configurarDisponibilidad(sedeId, dto, req.user.id, req.user.roles);
  }

  @Get('encargado/:sedeId/disponibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  getDisponibilidad(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerDisponibilidad(sedeId);
  }

  @Post('encargado/:sedeId/bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  crearBloqueo(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: CrearBloqueoAlquilerDto) {
    return this.alquileresService.crearBloqueo(sedeId, dto, req.user.id, req.user.roles);
  }

  @Delete('encargado/:sedeId/bloqueos/:bloqueoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  eliminarBloqueo(@Param('sedeId') sedeId: string, @Param('bloqueoId') bloqueoId: string, @Request() req) {
    return this.alquileresService.eliminarBloqueo(sedeId, bloqueoId, req.user.id, req.user.roles);
  }

  @Get('encargado/:sedeId/bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('encargado', 'admin')
  getBloqueos(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerBloqueos(sedeId);
  }

  // ════════════════════════════════════════════════════════
  // PÚBLICO — PARAMETERIZED LAST
  // ════════════════════════════════════════════════════════

  @Get()
  getSedesConAlquiler(@Query('ciudad') ciudad?: string, @Query('nombre') nombre?: string) {
    return this.alquileresService.obtenerSedesConAlquiler({ ciudad, nombre });
  }

  @Get('ciudades')
  getCiudadesConAlquiler() {
    return this.alquileresService.obtenerCiudadesConAlquiler();
  }

  @Get('buscar-disponibilidad')
  buscarDisponibilidad(
    @Query('ciudad') ciudad: string,
    @Query('fecha') fecha: string,
    @Query('horaInicio') horaInicio: string,
  ) {
    if (!ciudad || !fecha || !horaInicio) {
      throw new BadRequestException('ciudad, fecha y horaInicio son requeridos');
    }
    return this.alquileresService.buscarDisponibilidad(ciudad, fecha, horaInicio);
  }

  @Get(':sedeId')
  getSedeDetalle(@Param('sedeId') sedeId: string) {
    return this.alquileresService.obtenerSedeAlquilerDetalle(sedeId);
  }

  @Get(':sedeId/disponibilidad')
  getDisponibilidadDia(@Param('sedeId') sedeId: string, @Query('fecha') fecha: string) {
    return this.alquileresService.obtenerDisponibilidadDia(sedeId, fecha);
  }

  @Get(':sedeId/calendario')
  getCalendarioSemanal(@Param('sedeId') sedeId: string, @Query('fechaInicio') fechaInicio: string) {
    return this.alquileresService.obtenerCalendarioSemanal(sedeId, fechaInicio);
  }

  @Post(':sedeId/reservar')
  @UseGuards(JwtAuthGuard)
  crearReserva(@Param('sedeId') sedeId: string, @Request() req, @Body() dto: CrearReservaCanchaDto) {
    return this.alquileresService.crearReserva(req.user.id, sedeId, dto);
  }
}
