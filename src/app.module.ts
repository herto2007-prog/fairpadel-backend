import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { InscripcionesModule } from './modules/inscripciones/inscripciones.module';
import { FixtureModule } from './modules/fixture/fixture.module';
import { MatchesModule } from './modules/matches/matches.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { SedesModule } from './modules/sedes/sedes.module';
import { AlquileresModule } from './modules/alquileres/alquileres.module';
import { InstructoresModule } from './modules/instructores/instructores.module';
import { UploadsModule } from './uploads/uploads.module';
import { EmailModule } from './email/email.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    InscripcionesModule,
    FixtureModule,
    MatchesModule,
    RankingsModule,
    SedesModule,
    AlquileresModule,
    InstructoresModule,
    UploadsModule,
    EmailModule,
    SeedModule, // Seed automático al iniciar
  ],
})
export class AppModule {}
