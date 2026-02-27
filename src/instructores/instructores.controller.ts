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
} from '@nestjs/common';
import { InstructoresService } from './instructores.service';
import { SolicitarInstructorDto } from './dto/solicitar-instructor.dto';
import { ActualizarInstructorDto, ActualizarUbicacionesDto } from './dto/actualizar-instructor.dto';
import { ActualizarDisponibilidadDto, CrearBloqueoDto } from './dto/disponibilidad.dto';
import { CrearReservaDto, RechazarReservaDto } from './dto/reserva.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}

  // ── Public: list ──────────────────────────────────────

  @Get()
  buscarInstructores(
    @Query('ciudad') ciudad?: string,
    @Query('especialidad') especialidad?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.instructoresService.buscarInstructores({
      ciudad,
      especialidad,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ── Protected: any logged-in user ─────────────────────

  @Post('solicitar')
  @UseGuards(JwtAuthGuard)
  solicitarSerInstructor(
    @Request() req,
    @Body() dto: SolicitarInstructorDto,
  ) {
    return this.instructoresService.solicitarSerInstructor(req.user.id, dto);
  }

  @Get('mi-solicitud')
  @UseGuards(JwtAuthGuard)
  obtenerMiSolicitud(@Request() req) {
    return this.instructoresService.obtenerMiSolicitud(req.user.id);
  }

  // ── Protected: instructor role ────────────────────────

  @Get('mi-perfil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerMiPerfil(@Request() req) {
    return this.instructoresService.obtenerMiPerfil(req.user.id);
  }

  @Put('mi-perfil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  actualizarPerfil(
    @Request() req,
    @Body() dto: ActualizarInstructorDto,
  ) {
    return this.instructoresService.actualizarPerfil(req.user.id, dto);
  }

  @Put('ubicaciones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  actualizarUbicaciones(
    @Request() req,
    @Body() dto: ActualizarUbicacionesDto,
  ) {
    return this.instructoresService.actualizarUbicaciones(req.user.id, dto);
  }

  // ── Disponibilidad (instructor role) ────────────────

  @Get('disponibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerDisponibilidad(@Request() req) {
    return this.instructoresService.obtenerMiDisponibilidad(req.user.id);
  }

  @Put('disponibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  actualizarDisponibilidad(
    @Request() req,
    @Body() dto: ActualizarDisponibilidadDto,
  ) {
    return this.instructoresService.actualizarDisponibilidad(req.user.id, dto);
  }

  // ── Bloqueos (instructor role) ──────────────────────

  @Get('bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerBloqueos(@Request() req) {
    return this.instructoresService.obtenerMisBloqueos(req.user.id);
  }

  @Post('bloqueos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  crearBloqueo(@Request() req, @Body() dto: CrearBloqueoDto) {
    return this.instructoresService.crearBloqueo(req.user.id, dto);
  }

  @Delete('bloqueos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  eliminarBloqueo(@Request() req, @Param('id') id: string) {
    return this.instructoresService.eliminarBloqueo(req.user.id, id);
  }

  // ── Reservas: lado instructor ───────────────────────

  @Get('reservas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerReservasInstructor(
    @Request() req,
    @Query('estado') estado?: string,
  ) {
    return this.instructoresService.obtenerMisReservasComoInstructor(req.user.id, estado);
  }

  @Put('reservas/:id/confirmar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  confirmarReserva(@Request() req, @Param('id') id: string) {
    return this.instructoresService.confirmarReserva(id, req.user.id);
  }

  @Put('reservas/:id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  rechazarReserva(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RechazarReservaDto,
  ) {
    return this.instructoresService.rechazarReserva(id, req.user.id, dto);
  }

  @Put('reservas/:id/completar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  completarReserva(@Request() req, @Param('id') id: string) {
    return this.instructoresService.completarReserva(id, req.user.id);
  }

  // ── Agenda (instructor role) ────────────────────────

  @Get('agenda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerAgenda(
    @Request() req,
    @Query('fechaInicio') fechaInicio: string,
  ) {
    return this.instructoresService.obtenerAgendaSemana(req.user.id, fechaInicio);
  }

  // ── Reservas: lado alumno (cualquier user autenticado) ──

  @Get('mis-reservas')
  @UseGuards(JwtAuthGuard)
  obtenerMisReservas(
    @Request() req,
    @Query('estado') estado?: string,
  ) {
    return this.instructoresService.obtenerMisReservasComoAlumno(req.user.id, estado);
  }

  @Put('mis-reservas/:id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelarMiReserva(@Request() req, @Param('id') id: string) {
    return this.instructoresService.cancelarMiReserva(id, req.user.id);
  }

  // ── Public: detail + horarios (MUST be LAST — :id catches everything) ──

  @Get(':id/horarios-disponibles')
  getHorariosDisponibles(
    @Param('id') id: string,
    @Query('fecha') fecha: string,
  ) {
    return this.instructoresService.getHorariosDisponibles(id, fecha);
  }

  @Post(':id/reservar')
  @UseGuards(JwtAuthGuard)
  crearReserva(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: CrearReservaDto,
  ) {
    return this.instructoresService.crearReserva(id, req.user.id, dto);
  }

  @Get(':id')
  obtenerInstructorPublico(@Param('id') id: string) {
    return this.instructoresService.obtenerInstructorPublico(id);
  }
}
