import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppMessagingService } from './services/whatsapp-messaging.service';
import { WhatsAppConsentService } from './services/whatsapp-consent.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Módulo de WhatsApp Business API
 * 
 * FEATURE FLAG: WHATSAPP_ENABLED
 * - Si WHATSAPP_ENABLED !== 'true', el módulo opera en modo silencioso
 * - No envía mensajes reales, no falla, solo loguea
 * - Permite desarrollo y testing sin credenciales de Meta
 * 
 * Para activar: Setear WHATSAPP_ENABLED=true en variables de entorno
 * y configurar credenciales de Meta (WHATSAPP_ACCESS_TOKEN, etc.)
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [
    WhatsAppService,
    WhatsAppMessagingService,
    WhatsAppConsentService,
    WhatsAppWebhookService,
  ],
  exports: [WhatsAppService, WhatsAppMessagingService],
})
export class WhatsAppModule {}
