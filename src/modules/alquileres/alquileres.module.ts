import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlquileresService } from './alquileres.service';
import { AlquileresController } from './alquileres.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SuscripcionService } from './services/suscripcion.service';
import { SuscripcionController } from './controllers/suscripcion.controller';
import { SuscripcionGuard } from './guards/suscripcion.guard';
import { BancardService } from './services/bancard.service';
import { SedesAdminService } from '../sedes/sedes-admin.service';
import { DuenoController } from './controllers/dueno.controller';
import { EmailService } from '../../email/email.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AlquileresCronService } from './alquileres-cron.service';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, NotificacionesModule],
  controllers: [AlquileresController, SuscripcionController, DuenoController],
  providers: [
    AlquileresService,
    SuscripcionService,
    SuscripcionGuard,
    BancardService,
    SedesAdminService,
    EmailService,
    AlquileresCronService,
  ],
  exports: [AlquileresService, SuscripcionService, SuscripcionGuard],
})
export class AlquileresModule {}
