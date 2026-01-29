import { Module } from '@nestjs/common';
import { InscripcionesController } from './inscripciones.controller';
import { InscripcionesService } from './inscripciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ParejasModule } from '../parejas/parejas.module';
import { PagosModule } from '../pagos/pagos.module';

@Module({
  imports: [PrismaModule, ParejasModule, PagosModule],
  controllers: [InscripcionesController],
  providers: [InscripcionesService],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}