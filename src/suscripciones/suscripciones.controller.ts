import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SuscripcionesService } from './suscripciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSuscripcionDto } from './dto';

@Controller('suscripciones')
export class SuscripcionesController {
  constructor(private readonly suscripcionesService: SuscripcionesService) {}

  @Get('planes')
  obtenerPlanes() {
    return this.suscripcionesService.obtenerPlanes();
  }

  @Post('crear')
  @UseGuards(JwtAuthGuard)
  crearSuscripcion(@Body() dto: CreateSuscripcionDto, @Request() req) {
    return this.suscripcionesService.crearSuscripcion(dto, req.user.id);
  }

  @Get('mi-suscripcion')
  @UseGuards(JwtAuthGuard)
  obtenerMiSuscripcion(@Request() req) {
    return this.suscripcionesService.obtenerSuscripcionActiva(req.user.id);
  }

  @Get('historial')
  @UseGuards(JwtAuthGuard)
  obtenerHistorial(@Request() req) {
    return this.suscripcionesService.obtenerHistorialSuscripciones(req.user.id);
  }

  @Put('cancelar')
  @UseGuards(JwtAuthGuard)
  cancelarSuscripcion(@Request() req) {
    return this.suscripcionesService.cancelarSuscripcion(req.user.id);
  }

  @Put('reactivar')
  @UseGuards(JwtAuthGuard)
  reactivarSuscripcion(@Request() req) {
    return this.suscripcionesService.reactivarSuscripcion(req.user.id);
  }

  @Post('validar-cupon')
  validarCupon(@Body() body: { codigo: string }) {
    return this.suscripcionesService.validarCupon(body.codigo);
  }
}
