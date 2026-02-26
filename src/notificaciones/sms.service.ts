import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey = process.env.TIGO_BEEKUN_API_KEY;
  private readonly baseUrl = 'https://tigoc.beekun.com/pushapi';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Elimina tildes, enie y caracteres no-ASCII para mantener encoding GSM-7.
   * GSM-7 = 160 chars; UCS-2 (Unicode) = solo 70 chars → doble costo.
   */
  sanitizeForSms(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }

  /**
   * Envia un SMS via Tigo Business (Beekun).
   * Si TIGO_BEEKUN_API_KEY no esta configurado, solo loguea (dev mode).
   * Loguea cada intento en sms_logs para control de costos.
   */
  async enviarSms(
    telefono: string,
    message: string,
    meta?: { userId?: string; tipo?: string },
  ): Promise<{ success: boolean; messageId?: string }> {
    const sanitized = this.sanitizeForSms(message);
    const truncated = this.truncateGsm7(sanitized, 160);
    const cleanPhone = this.normalizePhone(telefono);

    if (!this.apiKey) {
      this.logger.warn(
        `[DEV] SMS no enviado (sin API key) -> ${cleanPhone}: ${truncated}`,
      );
      await this.logSms(cleanPhone, truncated, true, 'DEV_MODE', meta);
      return { success: true };
    }

    if (!telefono) {
      this.logger.warn('No phone number provided, SMS not sent');
      return { success: false };
    }

    const encoded = encodeURIComponent(truncated);

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}&message=${encoded}&msisdn=${cleanPhone}`;
      const response = await firstValueFrom(this.httpService.get(url));
      const responseStr = JSON.stringify(response.data);

      this.logger.log(`SMS enviado a ${cleanPhone}: ${responseStr}`);
      await this.logSms(cleanPhone, truncated, true, responseStr, meta);

      return {
        success: true,
        messageId: response.data?.message_id || response.data?.id,
      };
    } catch (error) {
      this.logger.error(`SMS fallo a ${cleanPhone}: ${error.message}`);
      await this.logSms(cleanPhone, truncated, false, error.message, meta);
      return { success: false };
    }
  }

  /**
   * Registra cada intento de SMS en sms_logs para control de costos.
   */
  private async logSms(
    telefono: string,
    mensaje: string,
    exitoso: boolean,
    providerResponse: string | null,
    meta?: { userId?: string; tipo?: string },
  ) {
    try {
      // Costo unitario configurable (default 250 Gs)
      let costoUnitario = 250;
      try {
        const config = await this.prisma.configuracionSistema.findUnique({
          where: { clave: 'SMS_COSTO_UNITARIO' },
        });
        if (config) costoUnitario = parseFloat(config.valor);
      } catch {
        // use default
      }

      await this.prisma.smsLog.create({
        data: {
          userId: meta?.userId || null,
          telefono,
          mensaje,
          tipo: (meta?.tipo as any) || null,
          exitoso,
          providerResponse: providerResponse || null,
          costoEstimado: exitoso ? costoUnitario : 0,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log SMS: ${err.message}`);
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
    meta?: { userId?: string; tipo?: string },
  ): Promise<{ success: boolean }> {
    const mensaje = `FairPadel: ${contenido}`;
    return this.enviarSms(telefono, mensaje, meta);
  }
}
