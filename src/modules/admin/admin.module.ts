import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriasController } from './admin-categorias.controller';
import { AdminModalidadesController } from './admin-modalidades.controller';
import { AdminTorneosController } from './admin-torneos.controller';
import { FairpadelAdminController } from './fairpadel-admin.controller';
import { AdminBracketController } from './admin-bracket.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BracketModule } from '../bracket';
import { ProgramacionModule } from '../programacion';
import { DemoModule } from '../demo/demo.module';

@Module({
  imports: [PrismaModule, BracketModule, DemoModule, ProgramacionModule],
  controllers: [
    AdminController,
    AdminCategoriasController,
    AdminModalidadesController,
    AdminTorneosController,
    FairpadelAdminController,
    AdminBracketController,
  ],
})
export class AdminModule {}
