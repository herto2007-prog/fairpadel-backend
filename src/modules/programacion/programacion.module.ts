import { Module } from '@nestjs/common';
import { ProgramacionService } from './programacion.service';
import { ProgramacionController } from './programacion.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DescansoCalculatorService } from './descanso-calculator.service';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';

@Module({
  imports: [PrismaModule],
  providers: [ProgramacionService, DescansoCalculatorService, TorneoGestionGuard],
  controllers: [ProgramacionController],
  exports: [ProgramacionService, DescansoCalculatorService],
})
export class ProgramacionModule {}
