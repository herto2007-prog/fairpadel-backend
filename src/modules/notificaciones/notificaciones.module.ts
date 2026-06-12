import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesWhatsAppService } from './notificaciones-whatsapp.service';
import { TorneosDeadlineCronService } from './torneos-deadline-cron.service';
import { EmailModule } from '../../email/email.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [EmailModule, WhatsAppModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesWhatsAppService, TorneosDeadlineCronService],
  exports: [NotificacionesService, NotificacionesWhatsAppService],
})
export class NotificacionesModule {}
