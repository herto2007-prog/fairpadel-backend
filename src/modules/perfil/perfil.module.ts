import { Module } from '@nestjs/common';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../../uploads/uploads.module';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [PerfilController],
  providers: [PerfilService],
  exports: [PerfilService],
})
export class PerfilModule {}
