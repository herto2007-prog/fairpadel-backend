import { Module } from '@nestjs/common';
import { PublicacionesService } from './publicaciones.service';
import { PublicacionesController } from './publicaciones.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../../uploads/uploads.module';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [PublicacionesController],
  providers: [PublicacionesService],
  exports: [PublicacionesService],
})
export class PublicacionesModule {}
