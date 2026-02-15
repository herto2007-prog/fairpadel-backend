import { Module } from '@nestjs/common';
import { FotosController } from './fotos.controller';
import { FotosService } from './fotos.service';
import { CloudinaryService } from './cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [FotosController],
  providers: [FotosService, CloudinaryService],
  exports: [FotosService, CloudinaryService],
})
export class FotosModule {}