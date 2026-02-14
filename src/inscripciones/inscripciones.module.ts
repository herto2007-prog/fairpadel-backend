import { Module } from '@nestjs/common';
import { InscripcionesController } from './inscripciones.controller';
import { InscripcionesService } from './inscripciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ParejasModule } from '../parejas/parejas.module';
import { PagosModule } from '../pagos/pagos.module';
import { TournamentRoleGuard } from '../auth/guards/tournament-role.guard';

@Module({
  imports: [PrismaModule, ParejasModule, PagosModule],
  controllers: [InscripcionesController],
  providers: [InscripcionesService, TournamentRoleGuard],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}
