import { Module } from '@nestjs/common';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesService } from './suscripciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PagosModule } from '../pagos/pagos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, PagosModule, NotificacionesModule],
  controllers: [SuscripcionesController],
  providers: [SuscripcionesService],
  exports: [SuscripcionesService],
})
export class SuscripcionesModule {}