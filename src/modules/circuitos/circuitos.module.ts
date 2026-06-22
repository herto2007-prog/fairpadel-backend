import { Module } from '@nestjs/common';
import { CircuitosService } from './circuitos.service';
import { CircuitosController } from './circuitos.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { RankingsModule } from '../rankings/rankings.module';

@Module({
  imports: [PrismaModule, CommonModule, TournamentsModule, RankingsModule],
  controllers: [CircuitosController],
  providers: [CircuitosService],
  exports: [CircuitosService],
})
export class CircuitosModule {}
