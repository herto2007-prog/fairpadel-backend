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
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ============ SEGUIMIENTOS ============
  @Post('seguir/:userId')
  seguir(@Param('userId') userId: string, @Request() req) {
    return this.socialService.seguir(req.user.id, userId);
  }

  @Delete('seguir/:userId')
  dejarDeSeguir(@Param('userId') userId: string, @Request() req) {
    return this.socialService.dejarDeSeguir(req.user.id, userId);
  }

  @Get('seguidores/:userId')
  obtenerSeguidores(@Param('userId') userId: string) {
    return this.socialService.obtenerSeguidores(userId);
  }

  @Get('siguiendo/:userId')
  obtenerSiguiendo(@Param('userId') userId: string) {
    return this.socialService.obtenerSiguiendo(userId);
  }

  @Get('sugerencias')
  obtenerSugerencias(@Request() req) {
    return this.socialService.obtenerSugerencias(req.user.id);
  }

  // ============ MENSAJERÍA ============
  @Post('mensajes')
  enviarMensaje(@Body() dto: MensajeDto, @Request() req) {
    return this.socialService.enviarMensaje(req.user.id, dto);
  }

  @Get('mensajes/conversaciones')
  obtenerConversaciones(@Request() req) {
    return this.socialService.obtenerConversaciones(req.user.id);
  }

  @Get('mensajes/conversacion/:otroUserId')
  obtenerMensajes(
    @Param('otroUserId') otroUserId: string,
    @Request() req,
  ) {
    return this.socialService.obtenerMensajes(req.user.id, otroUserId);
  }

  @Post('mensajes/:mensajeId/leer')
  marcarComoLeido(@Param('mensajeId') mensajeId: string, @Request() req) {
    return this.socialService.marcarComoLeido(mensajeId, req.user.id);
  }

  // ============ SOLICITUDES JUGAR ============
  @Post('solicitudes-jugar')
  enviarSolicitudJugar(@Body() dto: SolicitudJugarDto, @Request() req) {
    return this.socialService.enviarSolicitudJugar(req.user.id, dto);
  }

  @Get('solicitudes-jugar/recibidas')
  obtenerSolicitudesRecibidas(@Request() req) {
    return this.socialService.obtenerSolicitudesRecibidas(req.user.id);
  }

  @Get('solicitudes-jugar/enviadas')
  obtenerSolicitudesEnviadas(@Request() req) {
    return this.socialService.obtenerSolicitudesEnviadas(req.user.id);
  }

  @Post('solicitudes-jugar/:solicitudId/aceptar')
  aceptarSolicitud(@Param('solicitudId') solicitudId: string, @Request() req) {
    return this.socialService.aceptarSolicitud(solicitudId, req.user.id);
  }

  @Post('solicitudes-jugar/:solicitudId/rechazar')
  rechazarSolicitud(@Param('solicitudId') solicitudId: string, @Request() req) {
    return this.socialService.rechazarSolicitud(solicitudId, req.user.id);
  }

  // ============ BLOQUEOS ============
  @Post('bloquear/:userId')
  bloquear(@Param('userId') userId: string, @Request() req) {
    return this.socialService.bloquear(req.user.id, userId);
  }

  @Delete('bloquear/:userId')
  desbloquear(@Param('userId') userId: string, @Request() req) {
    return this.socialService.desbloquear(req.user.id, userId);
  }

  @Get('bloqueados')
  obtenerBloqueados(@Request() req) {
    return this.socialService.obtenerBloqueados(req.user.id);
  }

  // ============ REPORTES ============
  @Post('reportar/:userId')
  reportar(
    @Param('userId') userId: string,
    @Body() body: { motivo: string; descripcion?: string },
    @Request() req,
  ) {
    return this.socialService.reportar(req.user.id, userId, body);
  }

  // ============ BÚSQUEDA DE JUGADORES ============
  @Get('buscar-jugadores')
  buscarJugadores(
    @Query('q') query: string,
    @Query('ciudad') ciudad?: string,
    @Query('genero') genero?: string,
  ) {
    return this.socialService.buscarJugadores(query, ciudad, genero);
  }
}