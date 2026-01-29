import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, EmailService, SmsService],
  exports: [NotificacionesService, EmailService, SmsService],
})
export class NotificacionesModule {}