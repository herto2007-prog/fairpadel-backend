import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { PublicTournamentsController } from './public-tournaments.controller';
import { TournamentPublicationController } from './tournament-publication.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TournamentsController, PublicTournamentsController, TournamentPublicationController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
