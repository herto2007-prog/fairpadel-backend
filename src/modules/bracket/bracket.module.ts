import { Module } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { ClasificacionService } from './clasificacion.service';
import { ClasificacionController } from './clasificacion.controller';
import { CanchasSorteoService } from './canchas-sorteo.service';
import { CanchasSorteoController } from './canchas-sorteo.controller';
import { FixtureAuditoriaService } from './fixture-auditoria.service';
import { PartidoSlotsService } from './partido-slots.service';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProgramacionModule } from '../programacion/programacion.module';
import { CommonModule } from '../../common/common.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, ProgramacionModule, CommonModule, NotificacionesModule],
  controllers: [ClasificacionController, CanchasSorteoController],
  providers: [BracketService, ClasificacionService, CanchasSorteoService, FixtureAuditoriaService, PartidoSlotsService, TorneoGestionGuard],
  exports: [BracketService, ClasificacionService, CanchasSorteoService, FixtureAuditoriaService, PartidoSlotsService],
})
export class BracketModule {}
