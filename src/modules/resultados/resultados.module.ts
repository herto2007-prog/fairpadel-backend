import { Module } from '@nestjs/common';
import { ResultadosService } from './resultados.service';
import { ResultadosController } from './resultados.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { ProgramacionModule } from '../programacion/programacion.module';
import { ClasificacionService } from '../bracket/clasificacion.service';
import { ReaccionesFeedService } from '../bracket/reacciones-feed.service';
import { MatchTournamentGuard } from './guards/match-tournament.guard';

@Module({
  imports: [PrismaModule, CommonModule, ProgramacionModule],
  controllers: [ResultadosController],
  providers: [ResultadosService, ClasificacionService, ReaccionesFeedService, MatchTournamentGuard],
  exports: [ResultadosService, ClasificacionService],
})
export class ResultadosModule {}
