import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
