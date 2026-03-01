import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AlquileresController } from './alquileres.controller';
import { AlquileresService } from './alquileres.service';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [AlquileresController],
  providers: [AlquileresService],
  exports: [AlquileresService],
})
export class AlquileresModule {}
