import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { FixtureService } from './fixture.service';
import { TournamentRoleGuard } from '../auth/guards/tournament-role.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RankingsModule } from '../rankings/rankings.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FeedModule } from '../feed/feed.module';
import { LogrosModule } from '../logros/logros.module';

@Module({
  imports: [PrismaModule, RankingsModule, CategoriasModule, NotificacionesModule, FeedModule, LogrosModule],
  controllers: [MatchesController],
  providers: [MatchesService, FixtureService, TournamentRoleGuard],
  exports: [MatchesService, FixtureService],
})
export class MatchesModule {}
