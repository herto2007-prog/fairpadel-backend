import { Module } from '@nestjs/common';
import { CircuitosController } from './circuitos.controller';
import { CircuitosService } from './circuitos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CircuitosController],
  providers: [CircuitosService],
  exports: [CircuitosService],
})
export class CircuitosModule {}
