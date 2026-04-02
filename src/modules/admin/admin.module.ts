import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriasController } from './admin-categorias.controller';
import { AdminModalidadesController } from './admin-modalidades.controller';
import { AdminTorneosController } from './admin-torneos.controller';
import { FairpadelAdminController } from './fairpadel-admin.controller';
import { AdminBracketController } from './admin-bracket.controller';
import { AdminAuditoriaController } from './admin-auditoria.controller';
import { AdminSedesController } from './admin-sedes.controller';
import { AdminSuscripcionesController } from './admin-suscripciones.controller';
import { SedesAdminService } from '../sedes/sedes-admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BracketModule } from '../bracket';
import { ProgramacionModule } from '../programacion';
import { DemoModule } from '../demo/demo.module';

@Module({
  imports: [PrismaModule, BracketModule, DemoModule, ProgramacionModule],
  controllers: [
    // Orden importante: rutas más específicas primero
    AdminSuscripcionesController,
    AdminSedesController,
    AdminCategoriasController,
    AdminModalidadesController,
    AdminTorneosController,
    FairpadelAdminController,
    AdminBracketController,
    AdminAuditoriaController,
    AdminController, // Este va al final porque tiene rutas más genéricas
  ],
  providers: [SedesAdminService],
  exports: [SedesAdminService],
})
export class AdminModule {}
