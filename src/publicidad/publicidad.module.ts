import { Module } from '@nestjs/common';
import { PublicidadController } from './publicidad.controller';
import { PublicidadService } from './publicidad.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FotosModule } from '../fotos/fotos.module';

@Module({
  imports: [PrismaModule, FotosModule],
  controllers: [PublicidadController],
  providers: [PublicidadService],
  exports: [PublicidadService],
})
export class PublicidadModule {}
