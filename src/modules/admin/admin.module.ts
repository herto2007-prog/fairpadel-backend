import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriasController } from './admin-categorias.controller';
import { AdminModalidadesController } from './admin-modalidades.controller';
import { AdminTorneosController } from './admin-torneos.controller';
import { AdminControlPagosController } from './admin-control-pagos.controller';
import { AdminInscripcionesController } from './admin-inscripciones.controller';
import { AdminTorneoSedesController } from './admin-torneo-sedes.controller';
import { FairpadelAdminController } from './fairpadel-admin.controller';
import { AdminBracketController } from './admin-bracket.controller';
import { AdminAuditoriaController } from './admin-auditoria.controller';
import { AdminSedesController } from './admin-sedes.controller';
import { AdminSuscripcionesController } from './admin-suscripciones.controller';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { SedesAdminService } from '../sedes/sedes-admin.service';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { BracketModule } from '../bracket';
import { ProgramacionModule } from '../programacion';
import { DemoModule } from '../demo/demo.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RankingsModule } from '../rankings/rankings.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, BracketModule, DemoModule, ProgramacionModule, WhatsAppModule, RankingsModule, TournamentsModule],
  controllers: [
    // Orden importante: rutas más específicas primero
    WhatsAppAdminController,
    AdminSuscripcionesController,
    AdminSedesController,
    AdminCategoriasController,
    AdminModalidadesController,
    AdminTorneosController,
    AdminControlPagosController,
    AdminInscripcionesController,
    AdminTorneoSedesController,
    FairpadelAdminController,
    AdminBracketController,
    AdminAuditoriaController,
    AdminController, // Este va al final porque tiene rutas más genéricas
  ],
  providers: [SedesAdminService, TorneoGestionGuard],
  exports: [SedesAdminService],
})
export class AdminModule {}
