import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey = process.env.TIGO_BEEKUN_API_KEY;
  private readonly baseUrl = 'https://tigoc.beekun.com/pushapi';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Envia un SMS via Tigo Business (Beekun).
   * Si TIGO_BEEKUN_API_KEY no esta configurado, solo loguea (dev mode).
   */
  async enviarSms(
    telefono: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.apiKey) {
      this.logger.warn(
        `[DEV] SMS no enviado (sin API key) -> ${telefono}: ${message}`,
      );
      return { success: true };
    }

    if (!telefono) {
      this.logger.warn('No phone number provided, SMS not sent');
      return { success: false };
    }

    const truncated = this.truncateGsm7(message, 160);
    const encoded = encodeURIComponent(truncated);
    const cleanPhone = this.normalizePhone(telefono);

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}&message=${encoded}&msisdn=${cleanPhone}`;
      const response = await firstValueFrom(this.httpService.get(url));

      this.logger.log(
        `SMS enviado a ${cleanPhone}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: true,
        messageId: response.data?.message_id || response.data?.id,
      };
    } catch (error) {
      this.logger.error(`SMS fallo a ${cleanPhone}: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Normaliza telefono paraguayo a formato 595XXXXXXXXX.
   */
  normalizePhone(telefono: string): string {
    let clean = telefono.replace(/[\s\-\(\)\+]/g, '');
    if (clean.startsWith('0')) {
      clean = '595' + clean.substring(1);
    }
    if (!clean.startsWith('595')) {
      clean = '595' + clean;
    }
    return clean;
  }

  /**
   * Limpia y trunca mensaje para GSM-7 (160 chars max).
   * Elimina emojis y caracteres Unicode fuera del set GSM-7.
   */
  truncateGsm7(message: string, maxLen: number): string {
    const cleaned = message.replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      '',
    );
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.substring(0, maxLen - 3) + '...';
  }

  /**
   * Envia notificacion SMS con prefijo "FairPadel: ".
   */
  async enviarNotificacion(
    telefono: string,
    contenido: string,
  ): Promise<{ success: boolean }> {
    const mensaje = `FairPadel: ${contenido}`;
    return this.enviarSms(telefono, mensaje);
  }
}
