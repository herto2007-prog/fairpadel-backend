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

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  controllers: [AlquileresController, SuscripcionController],
  providers: [
    AlquileresService,
    SuscripcionService,
    SuscripcionGuard,
    BancardService,
    SedesAdminService,
  ],
  exports: [AlquileresService, SuscripcionService, SuscripcionGuard],
})
export class AlquileresModule {}
