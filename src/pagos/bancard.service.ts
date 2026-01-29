import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface CheckoutData {
  transactionId: string;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

@Injectable()
export class BancardService {
  private readonly publicKey = process.env.BANCARD_PUBLIC_KEY;
  private readonly privateKey = process.env.BANCARD_PRIVATE_KEY;
  private readonly environment = process.env.NODE_ENV === 'production' ? 'prod' : 'staging';
  private readonly baseUrl =
    this.environment === 'prod'
      ? 'https://vpos.infonet.com.py'
      : 'https://vpos.infonet.com.py:8888';

  async createCheckout(data: CheckoutData): Promise<string> {
    const {
      transactionId,
      amount,
      description,
      returnUrl,
      cancelUrl,
    } = data;

    // En producción real, aquí harías la llamada a la API de Bancard
    // Por ahora, simulamos el proceso

    const checkoutData = {
      public_key: this.publicKey,
      operation: {
        token: transactionId,
        shop_process_id: transactionId,
        currency: 'PYG',
        amount: amount.toString(),
        additional_data: '',
        description,
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    // Generar token de seguridad
    const token = this.generateToken(checkoutData);

    // URL de checkout simulada
    // En producción, usarías: `${this.baseUrl}/checkout/new`
    const checkoutUrl = `${this.baseUrl}/checkout/new?process_id=${transactionId}`;

    return checkoutUrl;
  }

  async verifyPayment(transactionId: string): Promise<any> {
    // En producción real, aquí consultarías el estado del pago en Bancard
    // Por ahora, simulamos una respuesta exitosa para desarrollo

    // Simulación: considerar pagos exitosos después de crear checkout
    return {
      status: 'success',
      transactionId,
      amount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  validateWebhook(webhookData: any): boolean {
    // Validar signature del webhook de Bancard
    const signature = webhookData.signature;
    const expectedSignature = this.generateWebhookSignature(webhookData);

    return signature === expectedSignature;
  }

  private generateToken(data: any): string {
    const stringToHash = JSON.stringify(data) + this.privateKey;
    return crypto.createHash('md5').update(stringToHash).digest('hex');
  }

  private generateWebhookSignature(data: any): string {
    const stringToHash = JSON.stringify(data) + this.privateKey;
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
  }
}