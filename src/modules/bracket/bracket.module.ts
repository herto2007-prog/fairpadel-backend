import { Module } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { ClasificacionService } from './clasificacion.service';
import { ClasificacionController } from './clasificacion.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProgramacionModule } from '../programacion/programacion.module';

@Module({
  imports: [PrismaModule, ProgramacionModule],
  controllers: [ClasificacionController],
  providers: [BracketService, ClasificacionService],
  exports: [BracketService, ClasificacionService],
})
export class BracketModule {}
