import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Sse,
  MessageEvent,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable, map, merge, interval } from 'rxjs';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePreferenciaDto } from './dto/update-preferencia.dto';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * SSE endpoint for real-time notification streaming.
   * Uses token query param since EventSource doesn't support custom headers.
   * No JwtAuthGuard here — we manually verify the token from query.
   */
  @UseGuards() // Override class-level guard — manual auth via query token
  @Sse('stream')
  stream(@Query('token') token: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    const userId = payload.id || payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Token inválido');
    }

    // Merge real notification events with a heartbeat every 30s to keep connection alive
    const notifications$ = this.notificacionesService.getStreamForUser(userId).pipe(
      map((event) => ({
        data: {
          tipo: event.tipo,
          titulo: event.titulo,
          contenido: event.contenido,
          count: event.count,
        },
      })),
    );

    const heartbeat$ = interval(30000).pipe(
      map(() => ({ data: { type: 'heartbeat' } })),
    );

    return merge(notifications$, heartbeat$);
  }

  @Get()
  obtenerNotificaciones(
    @Request() req,
    @Query('leida') leida?: string,
  ) {
    const leidaBool = leida === 'true' ? true : leida === 'false' ? false : undefined;
    return this.notificacionesService.obtenerNotificaciones(req.user.id, leidaBool);
  }

  @Get('no-leidas/count')
  contarNoLeidas(@Request() req) {
    return this.notificacionesService.contarNoLeidas(req.user.id);
  }

  @Get('preferencias')
  obtenerPreferencias(@Request() req) {
    return this.notificacionesService.obtenerPreferencias(req.user.id);
  }

  @Put('preferencias')
  actualizarPreferencia(
    @Request() req,
    @Body() dto: UpdatePreferenciaDto,
  ) {
    return this.notificacionesService.actualizarPreferencia(req.user.id, dto);
  }

  @Put('leer-todas')
  marcarTodasComoLeidas(@Request() req) {
    return this.notificacionesService.marcarTodasComoLeidas(req.user.id);
  }

  @Put(':id/leer')
  marcarComoLeida(@Param('id') id: string, @Request() req) {
    return this.notificacionesService.marcarComoLeida(id, req.user.id);
  }
}
