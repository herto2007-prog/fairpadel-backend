import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { CategoriasModule } from './categorias/categorias.module';
import { PublicidadModule } from './publicidad/publicidad.module';
import { FeedModule } from './feed/feed.module';
import { LogrosModule } from './logros/logros.module';
import { AlertasModule } from './alertas/alertas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    // ── Rate Limiting Global ──
    // Default: 60 requests por minuto por IP para toda la app.
    // Endpoints sensibles (login, register) tienen límites más estrictos via @Throttle().
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,  // 60 segundos (1 minuto)
        limit: 60,   // máximo 60 requests por minuto por IP
      },
    ]),

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
    CategoriasModule,
    PublicidadModule,
    FeedModule,
    LogrosModule,
    AlertasModule,
  ],
  controllers: [AppController],
  providers: [
    // Aplica ThrottlerGuard a TODOS los endpoints automáticamente.
    // Cada request cuenta contra el límite de su IP.
    // Si excede el límite → responde 429 Too Many Requests.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
