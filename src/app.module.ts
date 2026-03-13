import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { InscripcionesModule } from './modules/inscripciones/inscripciones.module';
import { FixtureModule } from './modules/fixture/fixture.module';
import { MatchesModule } from './modules/matches/matches.module';
import { SedesModule } from './modules/sedes/sedes.module';
import { AlquileresModule } from './modules/alquileres/alquileres.module';
import { InstructoresModule } from './modules/instructores/instructores.module';
import { UploadsModule } from './uploads/uploads.module';
import { EmailModule } from './email/email.module';
import { SeedModule } from './seed/seed.module';
import { AdminModule } from './modules/admin/admin.module';
import { ModalidadesModule } from './modules/modalidades/modalidades.module';
import { InvitacionesModule } from './modules/invitaciones/invitaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AppController } from './app.controller';
import { DemoPublicModule } from './modules/demo/demo-public.module';
import { ResultadosModule } from './modules/resultados/resultados.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { CircuitosModule } from './modules/circuitos/circuitos.module';

@Module({
  imports: [
    CommonModule, // Servicios globales como DateService
    PrismaModule,
    AdminModule, // Setup temporal - quitar después
    ModalidadesModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    InscripcionesModule,
    InvitacionesModule,
    NotificacionesModule,
    FixtureModule,
    MatchesModule,
    RankingsModule,
    SedesModule,
    AlquileresModule,
    InstructoresModule,
    UploadsModule,
    EmailModule,
    SeedModule, // Seed automático al iniciar
    DemoPublicModule, // Endpoint público para verificar estado de demo
    ResultadosModule, // Registro de resultados y marcador en vivo
    RankingsModule,   // Sistema de rankings y ascensos
    CircuitosModule,  // Circuitos y ligas de torneos
  ],
  controllers: [AppController],
})
export class AppModule {}
