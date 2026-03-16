import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InvitacionesController } from './invitaciones.controller';
import { InvitacionesCronService } from './invitaciones-cron.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, ScheduleModule.forRoot()],
  controllers: [InvitacionesController],
  providers: [InvitacionesCronService],
})
export class InvitacionesModule {}
