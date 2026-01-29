import { Module } from '@nestjs/common';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesService } from './suscripciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PagosModule } from '../pagos/pagos.module';

@Module({
  imports: [PrismaModule, PagosModule],
  controllers: [SuscripcionesController],
  providers: [SuscripcionesService],
  exports: [SuscripcionesService],
})
export class SuscripcionesModule {}