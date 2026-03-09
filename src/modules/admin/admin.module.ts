import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriasController } from './admin-categorias.controller';
import { AdminModalidadesController } from './admin-modalidades.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminController,
    AdminCategoriasController,
    AdminModalidadesController,
  ],
})
export class AdminModule {}
