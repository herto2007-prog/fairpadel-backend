import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SuscripcionService } from '../services/suscripcion.service';
import { BancardService } from '../services/bancard.service';
import { SedesAdminService } from '../../sedes/sedes-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('alquileres/suscripcion')
export class SuscripcionController {
  private readonly logger = new Logger(SuscripcionController.name);

  constructor(
    private readonly suscripcionService: SuscripcionService,
    private readonly bancardService: BancardService,
    private readonly sedesAdminService: SedesAdminService,
  ) {}

  /**
   * Verificar estado de suscripción de una sede
   * Público - cualquiera puede verificar
   */
  @Get(':sedeId/estado')
  @UseGuards(JwtAuthGuard)
  async verificarEstado(@Param('sedeId') sedeId: string) {
    const activa = await this.suscripcionService.verificarSuscripcionActiva(sedeId);
    const config = await this.suscripcionService.obtenerConfig(sedeId);
    
    return {
      activa,
      venceEn: config?.suscripcionVenceEn || null,
      tipo: config?.tipoSuscripcion || null,
      habilitado: config?.habilitado || false,
    };
  }

  /**
   * Iniciar proceso de pago de suscripción
   * Crea un registro de pago y obtiene process_id de Bancard
   */
  @Post(':sedeId/iniciar-pago')
  @UseGuards(JwtAuthGuard)
  async iniciarPago(
    @Param('sedeId') sedeId: string,
    @Body('tipo') tipo: 'MENSUAL' | 'ANUAL' = 'MENSUAL',
    @Request() req,
  ) {
    const userId = req.user?.id;
    
    // Verificar que el usuario es dueño de esta sede
    const esDueno = await this.sedesAdminService.esDuenoDeSede(userId, sedeId);
    if (!esDueno) {
      throw new BadRequestException('No eres el dueño de esta sede');
    }
    
    this.logger.log(`Iniciando pago de suscripción para sede ${sedeId} por usuario ${userId}`);
    return this.suscripcionService.iniciarPagoSuscripcion(sedeId, tipo);
  }

  /**
   * Webhook para recibir confirmación de Bancard
   * PÚBLICO - Bancard llama a este endpoint
   * 
   * Según la documentación de Bancard, este endpoint recibe:
   * POST con JSON en el body con la operación confirmada
   */
  @Post('webhook/confirmacion')
  @HttpCode(HttpStatus.OK)
  async recibirConfirmacion(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log('Webhook recibido de Bancard');
    this.logger.debug('Payload:', payload);

    try {
      // Validar estructura mínima del payload
      if (!payload || !payload.operation) {
        throw new BadRequestException('Payload inválido');
      }

      const resultado = await this.suscripcionService.procesarConfirmacionPago(payload);
      
      // Bancard espera una respuesta 200 con { status: 'success' }
      return { status: 'success', ...resultado };
    } catch (error) {
      this.logger.error('Error procesando webhook:', error);
      // Aún así devolvemos 200 para que Bancard no reintente
      // pero con indicación de error
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }

  /**
   * Activar suscripción manualmente (para testing/demo)
   * Solo para desarrollo - no usar en producción
   */
  @Post(':sedeId/activar-manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // Solo admin puede activar manualmente
  async activarManual(
    @Param('sedeId') sedeId: string,
    @Body('tipo') tipo: 'MENSUAL' | 'ANUAL' = 'MENSUAL',
  ) {
    return this.suscripcionService.activarSuscripcionManual(sedeId, tipo);
  }

  /**
   * Obtener historial de pagos
   */
  @Get(':sedeId/pagos')
  @UseGuards(JwtAuthGuard)
  async obtenerPagos(
    @Param('sedeId') sedeId: string,
    @Request() req,
  ) {
    const userId = req.user?.id;
    
    // Verificar que el usuario es dueño de esta sede
    const esDueno = await this.sedesAdminService.esDuenoDeSede(userId, sedeId);
    if (!esDueno) {
      throw new BadRequestException('No eres el dueño de esta sede');
    }
    
    return this.suscripcionService.obtenerHistorialPagos(sedeId);
  }

  /**
   * Obtener configuración de Bancard para el frontend
   * Esto permite al frontend cargar el iframe correctamente
   */
  @Get('config/bancard')
  @UseGuards(JwtAuthGuard)
  obtenerConfigBancard() {
    return {
      publicKey: this.bancardService.getPublicKey(),
      baseUrl: this.bancardService.getBaseUrl(),
      scriptUrl: `${this.bancardService.getBaseUrl()}/checkout/javascript/dist/bancard-checkout-4.0.0.js`,
    };
  }
}
