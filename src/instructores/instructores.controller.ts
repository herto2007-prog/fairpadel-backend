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
import {
  CrearReservaDto,
  RechazarReservaDto,
  CrearClaseManualDto,
  MarcarAsistenciaDto,
  MarcarPagoDto,
  GuardarNotasDto,
} from './dto/reserva.dto';
import { RegistrarPagoDto } from './dto/pago-instructor.dto';
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

  @Put('reservas/:id/asistencia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  marcarAsistencia(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: MarcarAsistenciaDto,
  ) {
    return this.instructoresService.marcarAsistencia(id, req.user.id, dto);
  }

  @Put('reservas/:id/pago')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  marcarPago(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: MarcarPagoDto,
  ) {
    return this.instructoresService.marcarPago(id, req.user.id, dto);
  }

  @Put('reservas/:id/notas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  guardarNotas(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: GuardarNotasDto,
  ) {
    return this.instructoresService.guardarNotas(id, req.user.id, dto);
  }

  // ── Clases manuales (instructor role) ────────────────

  @Post('clases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  crearClaseManual(@Request() req, @Body() dto: CrearClaseManualDto) {
    return this.instructoresService.crearClaseManual(req.user.id, dto);
  }

  // ── Alumnos (instructor role) ────────────────────────

  @Get('alumnos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerAlumnos(@Request() req) {
    return this.instructoresService.obtenerAlumnos(req.user.id);
  }

  @Get('alumnos/:alumnoId/historial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerHistorialAlumno(
    @Request() req,
    @Param('alumnoId') alumnoId: string,
    @Query('externoNombre') externoNombre?: string,
  ) {
    // If alumnoId is 'externo', use externoNombre query param
    if (alumnoId === 'externo') {
      return this.instructoresService.obtenerHistorialAlumno(req.user.id, undefined, externoNombre);
    }
    return this.instructoresService.obtenerHistorialAlumno(req.user.id, alumnoId);
  }

  // ── Finanzas (instructor role) ──────────────────────

  @Get('finanzas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerFinanzas(
    @Request() req,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.instructoresService.obtenerFinanzas(req.user.id, desde, hasta);
  }

  @Get('finanzas/mensual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerFinanzasMensual(
    @Request() req,
    @Query('anio') anio: string,
    @Query('mes') mes: string,
  ) {
    return this.instructoresService.obtenerFinanzasMensual(
      req.user.id,
      parseInt(anio),
      parseInt(mes),
    );
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

  // ── Pagos independientes (instructor role) ─────────────

  @Post('pagos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  registrarPago(@Request() req, @Body() dto: RegistrarPagoDto) {
    return this.instructoresService.registrarPago(req.user.id, dto);
  }

  @Get('pagos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  listarPagos(
    @Request() req,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('alumnoId') alumnoId?: string,
    @Query('metodoPago') metodoPago?: string,
  ) {
    return this.instructoresService.listarPagos(req.user.id, { desde, hasta, alumnoId, metodoPago });
  }

  @Get('pagos/:pagoId/recibo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerRecibo(@Request() req, @Param('pagoId') pagoId: string) {
    return this.instructoresService.obtenerRecibo(pagoId, req.user.id);
  }

  // ── Deudas (instructor role) ──────────────────────────

  @Get('deudas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerDeudas(@Request() req) {
    return this.instructoresService.obtenerDeudas(req.user.id);
  }

  // ── Métricas (instructor role) ────────────────────────

  @Get('metricas/retencion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  obtenerRetencion(@Request() req) {
    return this.instructoresService.obtenerRetencion(req.user.id);
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

  // ── Probar módulo (any auth user) ─────────────────────

  @Post('probar-modulo')
  @UseGuards(JwtAuthGuard)
  probarModulo(@Request() req) {
    return this.instructoresService.probarModulo(req.user.id);
  }

  // ── Public: detail + horarios (MUST be LAST — :id catches everything) ──

  @Get(':id/horarios-semana')
  getHorariosSemana(
    @Param('id') id: string,
    @Query('fechaInicio') fechaInicio: string,
  ) {
    return this.instructoresService.getHorariosSemana(id, fechaInicio);
  }

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
