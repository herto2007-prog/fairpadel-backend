import { Module } from '@nestjs/common';
import { InvitacionesController } from './invitaciones.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [InvitacionesController],
})
export class InvitacionesModule {}
