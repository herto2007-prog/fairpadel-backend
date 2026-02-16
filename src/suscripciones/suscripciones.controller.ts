import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  /**
   * Confirmar pago de suscripción.
   * Called after Bancard redirect — requires transactionId to prevent free premium exploit.
   * Ownership validated: only the subscription owner can confirm.
   */
  @Post('confirmar-pago')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  confirmarPago(
    @Body() body: { suscripcionId: string; transactionId: string },
    @Request() req,
  ) {
    return this.suscripcionesService.confirmarPagoSuscripcion(
      body.suscripcionId,
      body.transactionId,
      req.user.id,
    );
  }

  /**
   * Webhook for Bancard payment callbacks (no auth — Bancard calls directly).
   * Rate limited: 10 per minute to prevent abuse.
   */
  @Post('webhook/bancard')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  webhookBancard(@Body() webhookData: any) {
    // Basic validation: reject empty or malformed payloads
    if (!webhookData || !webhookData.operation) {
      return { status: 'invalid_payload' };
    }
    return this.suscripcionesService.procesarWebhookPago(webhookData);
  }
}
