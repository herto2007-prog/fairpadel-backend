import { Module } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { InscripcionesController } from './inscripciones.controller';
import { PublicInscripcionesController } from './public-inscripciones.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificacionesModule, EmailModule],
  controllers: [InscripcionesController, PublicInscripcionesController],
  providers: [InscripcionesService],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}
