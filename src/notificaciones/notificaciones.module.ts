import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, EmailService, SmsService],
  exports: [NotificacionesService, EmailService, SmsService],
})
export class NotificacionesModule {}
