import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeguirDto, MensajeDto, SolicitudJugarDto } from './dto';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ============ SEGUIMIENTOS ============
  @Post('seguir/:userId')
  @UseGuards(JwtAuthGuard)
  seguir(@Param('userId') userId: string, @Request() req) {
    return this.socialService.seguir(req.user.id, userId);
  }

  @Delete('seguir/:userId')
  @UseGuards(JwtAuthGuard)
  dejarDeSeguir(@Param('userId') userId: string, @Request() req) {
    return this.socialService.dejarDeSeguir(req.user.id, userId);
  }

  @Get('seguidores/:userId')
  @UseGuards(JwtAuthGuard)
  obtenerSeguidores(@Param('userId') userId: string) {
    return this.socialService.obtenerSeguidores(userId);
  }

  @Get('siguiendo/:userId')
  @UseGuards(JwtAuthGuard)
  obtenerSiguiendo(@Param('userId') userId: string) {
    return this.socialService.obtenerSiguiendo(userId);
  }

  @Get('sugerencias')
  @UseGuards(JwtAuthGuard)
  obtenerSugerencias(@Request() req) {
    return this.socialService.obtenerSugerencias(req.user.id);
  }

  // ============ MENSAJERÍA ============
  @Post('mensajes')
  @UseGuards(JwtAuthGuard)
  enviarMensaje(@Body() dto: MensajeDto, @Request() req) {
    return this.socialService.enviarMensaje(req.user.id, dto);
  }

  @Get('mensajes/conversaciones')
  @UseGuards(JwtAuthGuard)
  obtenerConversaciones(@Request() req) {
    return this.socialService.obtenerConversaciones(req.user.id);
  }

  @Get('mensajes/conversacion/:otroUserId')
  @UseGuards(JwtAuthGuard)
  obtenerMensajes(
    @Param('otroUserId') otroUserId: string,
    @Request() req,
  ) {
    return this.socialService.obtenerMensajes(req.user.id, otroUserId);
  }

  @Post('mensajes/:mensajeId/leer')
  @UseGuards(JwtAuthGuard)
  marcarComoLeido(@Param('mensajeId') mensajeId: string, @Request() req) {
    return this.socialService.marcarComoLeido(mensajeId, req.user.id);
  }

  // ============ SOLICITUDES JUGAR ============
  @Post('solicitudes-jugar')
  @UseGuards(JwtAuthGuard)
  enviarSolicitudJugar(@Body() dto: SolicitudJugarDto, @Request() req) {
    return this.socialService.enviarSolicitudJugar(req.user.id, dto);
  }

  @Get('solicitudes-jugar/recibidas')
  @UseGuards(JwtAuthGuard)
  obtenerSolicitudesRecibidas(@Request() req) {
    return this.socialService.obtenerSolicitudesRecibidas(req.user.id);
  }

  @Get('solicitudes-jugar/enviadas')
  @UseGuards(JwtAuthGuard)
  obtenerSolicitudesEnviadas(@Request() req) {
    return this.socialService.obtenerSolicitudesEnviadas(req.user.id);
  }

  @Post('solicitudes-jugar/:solicitudId/aceptar')
  @UseGuards(JwtAuthGuard)
  aceptarSolicitud(@Param('solicitudId') solicitudId: string, @Request() req) {
    return this.socialService.aceptarSolicitud(solicitudId, req.user.id);
  }

  @Post('solicitudes-jugar/:solicitudId/rechazar')
  @UseGuards(JwtAuthGuard)
  rechazarSolicitud(@Param('solicitudId') solicitudId: string, @Request() req) {
    return this.socialService.rechazarSolicitud(solicitudId, req.user.id);
  }

  // ============ BLOQUEOS ============
  @Post('bloquear/:userId')
  @UseGuards(JwtAuthGuard)
  bloquear(@Param('userId') userId: string, @Request() req) {
    return this.socialService.bloquear(req.user.id, userId);
  }

  @Delete('bloquear/:userId')
  @UseGuards(JwtAuthGuard)
  desbloquear(@Param('userId') userId: string, @Request() req) {
    return this.socialService.desbloquear(req.user.id, userId);
  }

  @Get('bloqueados')
  @UseGuards(JwtAuthGuard)
  obtenerBloqueados(@Request() req) {
    return this.socialService.obtenerBloqueados(req.user.id);
  }

  // ============ REPORTES ============
  @Post('reportar/:userId')
  @UseGuards(JwtAuthGuard)
  reportar(
    @Param('userId') userId: string,
    @Body() body: { motivo: string; descripcion?: string },
    @Request() req,
  ) {
    return this.socialService.reportar(req.user.id, userId, body);
  }

  // ============ BÚSQUEDA DE JUGADORES (PÚBLICO) ============
  @Get('buscar-jugadores')
  buscarJugadores(
    @Query('q') query?: string,
    @Query('ciudad') ciudad?: string,
    @Query('genero') genero?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.buscarJugadores(
      query,
      ciudad,
      genero,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('ciudades')
  obtenerCiudades() {
    return this.socialService.obtenerCiudadesActivas();
  }
}
