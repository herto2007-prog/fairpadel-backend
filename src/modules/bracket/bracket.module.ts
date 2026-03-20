import { Module } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { ClasificacionService } from './clasificacion.service';
import { ClasificacionController } from './clasificacion.controller';
import { CanchasSorteoService } from './canchas-sorteo.service';
import { CanchasSorteoController } from './canchas-sorteo.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProgramacionModule } from '../programacion/programacion.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, ProgramacionModule, CommonModule],
  controllers: [ClasificacionController, CanchasSorteoController],
  providers: [BracketService, ClasificacionService, CanchasSorteoService],
  exports: [BracketService, ClasificacionService, CanchasSorteoService],
})
export class BracketModule {}
