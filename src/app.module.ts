import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { ParejasModule } from './parejas/parejas.module';
import { InscripcionesModule } from './inscripciones/inscripciones.module';
import { PagosModule } from './pagos/pagos.module';
import { MatchesModule } from './matches/matches.module';
import { RankingsModule } from './rankings/rankings.module';
import { SocialModule } from './social/social.module';
import { FotosModule } from './fotos/fotos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { SuscripcionesModule } from './suscripciones/suscripciones.module';
import { AdminModule } from './admin/admin.module';
import { SedesModule } from './sedes/sedes.module';
import { CircuitosModule } from './circuitos/circuitos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    ParejasModule,
    InscripcionesModule,
    PagosModule,
    MatchesModule,
    RankingsModule,
    SocialModule,
    FotosModule,
    NotificacionesModule,
    SuscripcionesModule,
    AdminModule,
    SedesModule,
    CircuitosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
