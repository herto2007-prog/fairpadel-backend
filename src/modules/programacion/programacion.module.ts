import { Module } from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DescansoCalculatorService } from './descanso-calculator.service';

@Module({
  imports: [PrismaModule],
  providers: [ProgramacionService, DescansoCalculatorService],
  exports: [ProgramacionService, DescansoCalculatorService],
})
export class ProgramacionModule {}
