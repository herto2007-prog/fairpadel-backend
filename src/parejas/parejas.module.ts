import { Module } from '@nestjs/common';
import { ParejasController } from './parejas.controller';
import { ParejasService } from './parejas.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ParejasController],
  providers: [ParejasService],
  exports: [ParejasService],
})
export class ParejasModule {}