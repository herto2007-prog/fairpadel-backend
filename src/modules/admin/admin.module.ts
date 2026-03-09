import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriasController } from './admin-categorias.controller';
import { AdminModalidadesController } from './admin-modalidades.controller';
import { AdminTorneosController } from './admin-torneos.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminController,
    AdminCategoriasController,
    AdminModalidadesController,
    AdminTorneosController,
  ],
})
export class AdminModule {}
