import { Module } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { SedesAdminController } from './sedes-admin.controller';
import {
  SolicitudesSedePublicController,
  SolicitudesSedeAdminController,
} from './solicitudes-sede.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SedeGestionGuard } from '../../common/guards/sede-gestion.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    SedesController,
    SedesAdminController,
    SolicitudesSedePublicController,
    SolicitudesSedeAdminController,
  ],
  providers: [SedesService, SedeGestionGuard],
  exports: [SedesService],
})
export class SedesModule {}
