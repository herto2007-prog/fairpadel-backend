import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { InscripcionesModule } from './modules/inscripciones/inscripciones.module';
import { FixtureModule } from './modules/fixture/fixture.module';
import { MatchesModule } from './modules/matches/matches.module';
import { RankingsModule } from './modules/rankings/rankings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    AuthModule,
    TournamentsModule,
    InscripcionesModule,
    FixtureModule,
    MatchesModule,
    RankingsModule,
  ],
})
export class AppModule {}
