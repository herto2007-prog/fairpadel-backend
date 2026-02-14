import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePreferenciaDto } from './dto/update-preferencia.dto';

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
