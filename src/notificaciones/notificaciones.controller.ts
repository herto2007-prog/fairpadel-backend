import {
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

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

  @Put(':id/leer')
  marcarComoLeida(@Param('id') id: string, @Request() req) {
    return this.notificacionesService.marcarComoLeida(id, req.user.id);
  }

  @Put('leer-todas')
  marcarTodasComoLeidas(@Request() req) {
    return this.notificacionesService.marcarTodasComoLeidas(req.user.id);
  }
}