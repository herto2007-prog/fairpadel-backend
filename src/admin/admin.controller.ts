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
import { AdminService } from './admin.service';
import { SeedTestDataDto } from './dto/seed-test-data.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============ TORNEOS ============
  @Get('torneos-pendientes')
  obtenerTorneosPendientes() {
    return this.adminService.obtenerTorneosPendientes();
  }

  @Put('torneos/:id/aprobar')
  aprobarTorneo(@Param('id') id: string) {
    return this.adminService.aprobarTorneo(id);
  }

  @Put('torneos/:id/rechazar')
  rechazarTorneo(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.adminService.rechazarTorneo(id, body.motivo);
  }

  // ============ SOLICITUDES ORGANIZADOR ============
  @Get('solicitudes-organizador')
  obtenerSolicitudesOrganizador(@Query('estado') estado?: string) {
    return this.adminService.obtenerSolicitudesOrganizador(estado);
  }

  @Put('solicitudes-organizador/:id/aprobar')
  aprobarSolicitudOrganizador(@Param('id') id: string) {
    return this.adminService.aprobarSolicitudOrganizador(id);
  }

  @Put('solicitudes-organizador/:id/rechazar')
  rechazarSolicitudOrganizador(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.adminService.rechazarSolicitudOrganizador(id, body.motivo);
  }

  @Post('promover-organizador')
  promoverOrganizador(@Body() body: { documento: string }) {
    return this.adminService.promoverOrganizadorPorDocumento(body.documento);
  }

  // ============ MODERACIÓN FOTOS ============
  @Get('fotos-moderacion')
  obtenerFotosModeracion() {
    return this.adminService.obtenerFotosModeracion();
  }

  @Put('fotos/:id/aprobar')
  aprobarFoto(@Param('id') id: string) {
    return this.adminService.aprobarFoto(id);
  }

  @Put('fotos/:id/eliminar')
  eliminarFoto(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.adminService.eliminarFotoInapropiada(id, body.motivo);
  }

  // ============ USUARIOS ============
  @Get('usuarios')
  obtenerUsuarios(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    return this.adminService.obtenerUsuarios(search, estado);
  }

  @Put('usuarios/:id/suspender')
  suspenderUsuario(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.adminService.suspenderUsuario(id, body.motivo);
  }

  @Put('usuarios/:id/activar')
  activarUsuario(@Param('id') id: string) {
    return this.adminService.activarUsuario(id);
  }

  // ============ REPORTES ============
  @Get('reportes/fotos')
  obtenerReportesFotos(@Query('estado') estado?: string) {
    return this.adminService.obtenerReportesFotos(estado);
  }

  @Get('reportes/usuarios')
  obtenerReportesUsuarios(@Query('estado') estado?: string) {
    return this.adminService.obtenerReportesUsuarios(estado);
  }

  @Put('reportes/fotos/:id/resolver')
  resolverReporteFoto(
    @Param('id') id: string,
    @Body() body: { accion: string },
  ) {
    return this.adminService.resolverReporteFoto(id, body.accion);
  }

  @Put('reportes/usuarios/:id/resolver')
  resolverReporteUsuario(
    @Param('id') id: string,
    @Body() body: { accion: string },
  ) {
    return this.adminService.resolverReporteUsuario(id, body.accion);
  }

  // ============ SUSCRIPCIONES ============
  @Get('suscripciones')
  obtenerSuscripciones(@Query('estado') estado?: string) {
    return this.adminService.obtenerSuscripciones(estado);
  }

  @Put('suscripciones/:id/extender')
  extenderSuscripcion(
    @Param('id') id: string,
    @Body() body: { dias: number },
  ) {
    return this.adminService.extenderSuscripcion(id, body.dias);
  }

  // ============ CONFIGURACIÓN ============
  @Get('configuracion/puntos')
  obtenerConfiguracionPuntos() {
    return this.adminService.obtenerConfiguracionPuntos();
  }

  @Put('configuracion/puntos/:id')
  actualizarConfiguracionPuntos(
    @Param('id') id: string,
    @Body() body: { puntosBase: number; multiplicador: number },
  ) {
    return this.adminService.actualizarConfiguracionPuntos(id, body);
  }

  // ============ CONFIGURACIÓN SISTEMA ============
  @Get('configuracion/sistema')
  obtenerConfiguracionSistema() {
    return this.adminService.obtenerConfiguracionSistema();
  }

  @Put('configuracion/sistema/:clave')
  actualizarConfiguracionSistema(
    @Param('clave') clave: string,
    @Body() body: { valor: string },
  ) {
    return this.adminService.actualizarConfiguracionSistema(clave, body.valor);
  }

  // ============ CUPONES ============
  @Post('cupones')
  crearCupon(@Body() body: any) {
    return this.adminService.crearCupon(body);
  }

  @Get('cupones')
  obtenerCupones() {
    return this.adminService.obtenerCupones();
  }

  @Put('cupones/:id/desactivar')
  desactivarCupon(@Param('id') id: string) {
    return this.adminService.desactivarCupon(id);
  }

  // ============ MÉTRICAS ============
  @Get('metricas/dashboard')
  obtenerMetricasDashboard() {
    return this.adminService.obtenerMetricasDashboard();
  }

  @Get('metricas/usuarios')
  obtenerMetricasUsuarios() {
    return this.adminService.obtenerMetricasUsuarios();
  }

  @Get('metricas/torneos')
  obtenerMetricasTorneos() {
    return this.adminService.obtenerMetricasTorneos();
  }

  @Get('metricas/ingresos')
  obtenerMetricasIngresos() {
    return this.adminService.obtenerMetricasIngresos();
  }

  // ============ PREMIUM DASHBOARD ============
  @Get('premium/usuarios')
  obtenerUsuariosPremium(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    return this.adminService.obtenerUsuariosPremium(search, estado);
  }

  @Get('premium/metricas')
  obtenerMetricasPremium() {
    return this.adminService.obtenerMetricasPremium();
  }

  @Get('premium/tendencias')
  obtenerTendenciasSuscripciones() {
    return this.adminService.obtenerTendenciasSuscripciones();
  }

  @Get('premium/actividad')
  obtenerActividadPremium() {
    return this.adminService.obtenerActividadPremium();
  }

  @Post('premium/otorgar')
  otorgarPremiumManual(
    @Body() body: { userId: string; dias: number; motivo: string },
  ) {
    return this.adminService.otorgarPremiumManual(
      body.userId,
      body.dias,
      body.motivo,
    );
  }

  @Put('premium/revocar/:userId')
  revocarPremium(@Param('userId') userId: string) {
    return this.adminService.revocarPremium(userId);
  }

  @Get('premium/cupones/stats')
  obtenerEstadisticasCupones() {
    return this.adminService.obtenerEstadisticasCupones();
  }

  // ============ SEED TEST DATA (TEMPORAL) ============
  @Post('torneos/:id/seed-test-data')
  seedTestData(
    @Param('id') id: string,
    @Body() dto: SeedTestDataDto,
  ) {
    return this.adminService.seedTestData(id, dto.parejasPorCategoria);
  }

  // ============ COMISION POR TORNEO ============
  @Put('tournaments/:id/comision')
  setComisionTorneo(
    @Param('id') id: string,
    @Body() body: { comisionPorcentaje: number | null },
  ) {
    return this.adminService.setComisionTorneo(id, body.comisionPorcentaje);
  }

  @Get('tournaments/:id/comision')
  getComisionTorneo(@Param('id') id: string) {
    return this.adminService.getComisionTorneo(id);
  }
}