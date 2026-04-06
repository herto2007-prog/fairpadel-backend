import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { Public } from '../../auth/decorators/public.decorator';

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
    // El JWT Strategy devuelve 'userId', no 'id'
    const userId = req.user?.userId;
    
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
   * 
   * Nota: Bancard agrega ?output=json a la URL, pero NestJS maneja
   * los query params automáticamente si usamos @Query
   */
  @Post('webhook/confirmacion')
  @Public()
  @HttpCode(HttpStatus.OK)
  async recibirConfirmacion(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Query() query: any,
  ) {
    this.logger.log('========================================');
    this.logger.log('WEBHOOK BANCARD RECIBIDO');
    this.logger.log('========================================');
    this.logger.log('Headers:', JSON.stringify(headers));
    this.logger.log('Query:', JSON.stringify(query));
    this.logger.log('Payload:', JSON.stringify(payload));

    try {
      // Validar estructura mínima del payload
      if (!payload || !payload.operation) {
        this.logger.error('Payload inválido - no tiene operation');
        throw new BadRequestException('Payload inválido');
      }

      const resultado = await this.suscripcionService.procesarConfirmacionPago(payload);
      
      this.logger.log('Webhook procesado exitosamente:', JSON.stringify(resultado));
      
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
    // El JWT Strategy devuelve 'userId', no 'id'
    const userId = req.user?.userId;
    
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
      scriptUrl: `${this.bancardService.getBaseUrl()}/checkout/javascript/dist/bancard-checkout-1.0.0.js`,
    };
  }

  // ============================================================
  // ENDPOINTS PARA TESTS DE BANCARD (Checklist de integración)
  // ============================================================

  /**
   * POST /alquileres/suscripcion/rollback
   * Rollback de una transacción (para tests de Bancard)
   * Permite cancelar una transacción pendiente
   */
  @Post('rollback')
  @UseGuards(JwtAuthGuard)
  async rollbackTransaccion(
    @Body('shopProcessId') shopProcessId: string,
  ) {
    this.logger.log(`Rollback solicitado para shop_process_id: ${shopProcessId}`);
    
    try {
      const resultado = await this.bancardService.rollbackTransaccion(shopProcessId, '0.00', 'USD');
      return {
        status: 'success',
        message: 'Rollback procesado',
        data: resultado,
      };
    } catch (error) {
      this.logger.error('Error en rollback:', error);
      throw new BadRequestException('No se pudo realizar el rollback');
    }
  }

  /**
   * POST /alquileres/suscripcion/consultar
   * Consultar estado de una transacción (para tests de Bancard)
   * Permite al comercio consultar si un pago fue confirmado
   */
  @Post('consultar')
  @UseGuards(JwtAuthGuard)
  async consultarTransaccion(
    @Body('shopProcessId') shopProcessId: string,
  ) {
    this.logger.log(`Consulta de transacción: shop_process_id=${shopProcessId}`);
    
    try {
      const resultado = await this.bancardService.consultarTransaccion(shopProcessId);
      return {
        status: 'success',
        data: resultado,
      };
    } catch (error) {
      this.logger.error('Error consultando transacción:', error);
      throw new BadRequestException('No se pudo consultar la transacción');
    }
  }

  /**
   * GET /alquileres/suscripcion/:sedeId/verificar-pago/:pagoId
   * Verifica el estado de un pago específico en FairPadel
   * Usado por el frontend después de completar el pago en Bancard
   */
  @Get(':sedeId/verificar-pago/:pagoId')
  @UseGuards(JwtAuthGuard)
  async verificarEstadoPago(
    @Param('sedeId') sedeId: string,
    @Param('pagoId') pagoId: string,
    @Request() req,
  ) {
    const userId = req.user?.userId;
    
    // Verificar que el usuario es dueño de esta sede
    const esDueno = await this.sedesAdminService.esDuenoDeSede(userId, sedeId);
    if (!esDueno) {
      throw new BadRequestException('No eres el dueño de esta sede');
    }

    const pago = await this.suscripcionService.obtenerPagoPorId(pagoId);
    
    if (!pago || pago.sedeId !== sedeId) {
      throw new BadRequestException('Pago no encontrado');
    }

    return {
      status: 'success',
      pago: {
        id: pago.id,
        estado: pago.estado,
        monto: pago.monto,
        moneda: pago.moneda,
        metodo: pago.metodo,
        fechaPago: pago.fechaPago,
        periodoDesde: pago.periodoDesde,
        periodoHasta: pago.periodoHasta,
        referencia: pago.referencia,
        createdAt: pago.createdAt,
      },
    };
  }

  /**
   * POST /alquileres/suscripcion/verificar-en-bancard
   * Consulta el estado de una transacción directamente en Bancard
   * Útil cuando el webhook no llegó o falló
   */
  @Post('verificar-en-bancard')
  @UseGuards(JwtAuthGuard)
  async verificarEnBancard(
    @Body('shopProcessId') shopProcessId: string,
    @Request() req,
  ) {
    this.logger.log(`Verificando transacción en Bancard: shop_process_id=${shopProcessId}`);
    
    try {
      // Consultar en Bancard
      const resultadoBancard = await this.bancardService.consultarTransaccion(shopProcessId);
      
      this.logger.log('Respuesta de Bancard:', JSON.stringify(resultadoBancard));
      
      // Si la transacción fue exitosa en Bancard pero no en nuestro sistema, procesarla
      if (resultadoBancard?.confirmation?.response === 'S' || 
          resultadoBancard?.operation?.response === 'S') {
        
        // Buscar el pago por referencia
        const pago = await this.suscripcionService.obtenerPagoPorReferencia(shopProcessId);
        
        if (pago && pago.estado !== 'COMPLETADO') {
          this.logger.log(`Completando pago ${pago.id} que fue exitoso en Bancard pero no en nuestro sistema`);
          
          // Procesar manualmente
          await this.suscripcionService.completarPagoManual(pago.id);
          
          return {
            status: 'success',
            mensaje: 'Pago verificado y completado',
            pago: {
              id: pago.id,
              estado: 'COMPLETADO',
            },
            bancardData: resultadoBancard,
          };
        }
        
        return {
          status: 'success',
          mensaje: 'Pago ya estaba completado',
          pago: pago ? { id: pago.id, estado: pago.estado } : null,
          bancardData: resultadoBancard,
        };
      }
      
      return {
        status: 'pending',
        mensaje: 'Transacción no confirmada en Bancard',
        bancardData: resultadoBancard,
      };
    } catch (error) {
      this.logger.error('Error verificando en Bancard:', error);
      throw new BadRequestException('No se pudo verificar el estado del pago en Bancard');
    }
  }

  /**
   * POST /alquileres/suscripcion/simular-pago/:pagoId
   * Simula un pago exitoso (SOLO PARA TESTING EN STAGING)
   * Usa los clientes de prueba de Bancard para completar el flujo
   */
  @Post('simular-pago/:pagoId')
  @UseGuards(JwtAuthGuard)
  async simularPago(
    @Param('pagoId') pagoId: string,
    @Request() req,
  ) {
    const userId = req.user?.userId;
    
    this.logger.log(`Simulando pago exitoso para pagoId: ${pagoId}`);
    
    try {
      // Obtener el pago
      const pago = await this.suscripcionService.obtenerPagoPorId(pagoId);
      
      if (!pago) {
        throw new BadRequestException('Pago no encontrado');
      }
      
      // Verificar que el usuario es dueño de la sede
      const esDueno = await this.sedesAdminService.esDuenoDeSede(userId, pago.sedeId);
      if (!esDueno) {
        throw new BadRequestException('No eres el dueño de esta sede');
      }
      
      // Completar el pago manualmente
      await this.suscripcionService.completarPagoManual(pagoId);
      
      return {
        status: 'success',
        mensaje: 'Pago simulado exitosamente',
        pago: {
          id: pagoId,
          estado: 'COMPLETADO',
        },
      };
    } catch (error) {
      this.logger.error('Error simulando pago:', error);
      throw new BadRequestException('No se pudo simular el pago');
    }
  }

  /**
   * POST /alquileres/suscripcion/test/webhook
   * Simula un webhook de Bancard para testing
   * Permite verificar que nuestro endpoint de webhook funciona correctamente
   */
  @Post('test/webhook')
  @UseGuards(JwtAuthGuard)
  async testWebhook(
    @Body() payload: {
      shopProcessId: string;
      response?: 'S' | 'N';
      amount?: string;
      currency?: string;
    },
    @Request() req,
  ) {
    this.logger.log('========================================');
    this.logger.log('TEST WEBHOOK BANCARD - SIMULACIÓN');
    this.logger.log('========================================');
    
    try {
      // Buscar el pago por referencia
      const pago = await this.suscripcionService.obtenerPagoPorReferencia(payload.shopProcessId);
      
      if (!pago) {
        return {
          status: 'error',
          mensaje: `No se encontró pago con referencia: ${payload.shopProcessId}`,
          sugerencia: 'Creá primero un pago iniciado desde el frontend para tener una referencia válida',
        };
      }

      // Construir payload similar al de Bancard
      const webhookPayload = {
        operation: {
          token: 'token_test_' + Date.now(),
          shop_process_id: parseInt(payload.shopProcessId),
          response: payload.response || 'S',
          response_details: payload.response === 'N' ? 'Pago rechazado' : 'Operación exitosa',
          amount: payload.amount || pago.monto.toString(),
          currency: payload.currency || pago.moneda,
          authorization_number: '123456',
          ticket_number: 'TICKET' + Date.now(),
          response_code: payload.response === 'N' ? '99' : '00',
          response_description: payload.response === 'N' ? 'Pago rechazado' : 'Operación exitosa',
        },
      };

      this.logger.log('Payload simulado:', JSON.stringify(webhookPayload));
      this.logger.log('Pago encontrado:', JSON.stringify({ id: pago.id, estado: pago.estado }));

      // Procesar el webhook
      const resultado = await this.suscripcionService.procesarConfirmacionPago(webhookPayload);

      return {
        status: 'success',
        mensaje: 'Webhook procesado correctamente',
        resultado,
        pagoActualizado: {
          id: pago.id,
          nuevoEstado: payload.response === 'N' ? 'FALLIDO' : 'COMPLETADO',
        },
      };
    } catch (error) {
      this.logger.error('Error en test webhook:', error);
      return {
        status: 'error',
        mensaje: 'Error procesando webhook simulado',
        error: error.message,
      };
    }
  }
}
