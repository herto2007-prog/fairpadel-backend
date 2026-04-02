import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Servicio para integración con Bancard VPOS 2.0
 * Documentación: https://vpos.infonet.com.py
 */
@Injectable()
export class BancardService {
  private readonly logger = new Logger(BancardService.name);
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly baseUrl: string;
  private readonly returnUrl: string;
  private readonly cancelUrl: string;

  constructor(private configService: ConfigService) {
    // Las claves se configuran en Railway Dashboard (Variables)
    this.publicKey = this.configService.get('BANCARD_PUBLIC_KEY') || '';
    this.privateKey = this.configService.get('BANCARD_PRIVATE_KEY') || '';
    
    // Ambiente: staging o producción
    const env = this.configService.get('BANCARD_ENV') || 'staging';
    this.baseUrl = env === 'production' 
      ? 'https://vpos.infonet.com.py'
      : 'https://vpos.infonet.com.py:8888';
    
    // URLs de retorno después del pago
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    this.returnUrl = `${appUrl}/suscripcion/confirmacion`;
    this.cancelUrl = `${appUrl}/suscripcion/cancelacion`;
    
    // Log de estado (sin revelar las claves)
    if (!this.publicKey || !this.privateKey) {
      this.logger.warn('⚠️  BANCARD_PUBLIC_KEY o BANCARD_PRIVATE_KEY no configuradas. Los pagos no funcionarán.');
      this.logger.warn('   Configura estas variables en Railway Dashboard → Variables');
    } else {
      this.logger.log(`✅ Bancard configurado (${env})`);
    }
  }

  /**
   * Genera token MD5 para single_buy
   * md5(private_key + shop_process_id + amount + currency)
   */
  private generateSingleBuyToken(
    shopProcessId: string | number,
    amount: string,
    currency: string,
  ): string {
    const data = `${this.privateKey}${shopProcessId}${amount}${currency}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Genera token MD5 para confirm
   * md5(private_key + shop_process_id + "confirm" + amount + currency)
   */
  generateConfirmToken(
    shopProcessId: string | number,
    amount: string,
    currency: string,
  ): string {
    const data = `${this.privateKey}${shopProcessId}confirm${amount}${currency}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Genera token MD5 para rollback
   * md5(private_key + shop_process_id + "rollback" + amount + currency)
   */
  generateRollbackToken(
    shopProcessId: string | number,
    amount: string,
    currency: string,
  ): string {
    const data = `${this.privateKey}${shopProcessId}rollback${amount}${currency}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Inicia un pago ocasional (single_buy)
   * 
   * @param shopProcessId - ID único de la transacción (nuestro pagoId)
   * @param amount - Monto en formato "999.99" (2 decimales)
   * @param currency - "PYG" o "USD"
   * @param description - Descripción del pago (máx 20 chars)
   */
  async iniciarPago(
    shopProcessId: string | number,
    amount: string,
    currency: string = 'USD',
    description: string = 'Suscripcion FairPadel',
  ): Promise<{ processId: string; status: string }> {
    
    if (!this.publicKey || !this.privateKey) {
      throw new Error(
        'BANCARD_PUBLIC_KEY y BANCARD_PRIVATE_KEY no están configuradas. ' +
        'Por favor, configura estas variables en Railway Dashboard → Variables'
      );
    }

    const token = this.generateSingleBuyToken(shopProcessId, amount, currency);

    const payload = {
      public_key: this.publicKey,
      operation: {
        token,
        shop_process_id: shopProcessId,
        currency,
        amount,
        description: description.substring(0, 20),
        return_url: this.returnUrl,
        cancel_url: this.cancelUrl,
      },
    };

    try {
      this.logger.log(`Iniciando pago Bancard: shop_process_id=${shopProcessId}, amount=${amount}, currency=${currency}`);
      this.logger.debug(`Payload Bancard: ${JSON.stringify(payload)}`);
      
      const response = await fetch(`${this.baseUrl}/vpos/api/0.3/single_buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 'success' && data.process_id) {
        this.logger.log(`Pago iniciado correctamente: process_id=${data.process_id}`);
        return {
          processId: data.process_id,
          status: data.status,
        };
      } else {
        this.logger.error('Error iniciando pago Bancard:', data);
        throw new Error(`Error Bancard: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      this.logger.error('Error en iniciarPago:', error);
      throw error;
    }
  }

  /**
   * Consulta el estado de una transacción
   */
  async consultarTransaccion(shopProcessId: string | number): Promise<any> {
    const token = crypto
      .createHash('md5')
      .update(`${this.privateKey}${shopProcessId}get_confirmation`)
      .digest('hex');

    const payload = {
      public_key: this.publicKey,
      operation: {
        token,
        shop_process_id: shopProcessId,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/vpos/api/0.3/single_buy/confirmations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return await response.json();
    } catch (error) {
      this.logger.error('Error consultando transacción:', error);
      throw error;
    }
  }

  /**
   * Realiza rollback de una transacción
   */
  async rollbackTransaccion(
    shopProcessId: string | number,
    amount: string,
    currency: string = 'USD',
  ): Promise<any> {
    // Para rollback, el amount debe ser "0.00" según documentación
    const token = this.generateRollbackToken(shopProcessId, '0.00', currency);

    const payload = {
      public_key: this.publicKey,
      operation: {
        token,
        shop_process_id: shopProcessId,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/vpos/api/0.3/single_buy/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return await response.json();
    } catch (error) {
      this.logger.error('Error en rollback:', error);
      throw error;
    }
  }

  /**
   * Verifica que el token de confirmación del webhook sea válido
   */
  verificarTokenConfirmacion(
    shopProcessId: string | number,
    amount: string,
    currency: string,
    tokenRecibido: string,
  ): boolean {
    const tokenEsperado = this.generateConfirmToken(shopProcessId, amount, currency);
    return tokenEsperado === tokenRecibido;
  }

  /**
   * Obtiene la URL base del ambiente Bancard
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Obtiene la public key (para usar en frontend)
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
