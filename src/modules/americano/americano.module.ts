import { Module } from '@nestjs/common';
import { AmericanoService } from './americano.service';
import { AmericanoComunService } from './americano-comun.service';
import { AmericanoResultadosService } from './americano-resultados.service';
import { AmericanoRondasService } from './americano-rondas.service';
import { AmericanoInscripcionesService } from './americano-inscripciones.service';
import { AmericanoController } from './americano.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [PrismaModule, AuthModule, TournamentsModule, AlertasModule],
  controllers: [AmericanoController],
  providers: [AmericanoService, AmericanoComunService, AmericanoResultadosService, AmericanoRondasService, AmericanoInscripcionesService],
  exports: [AmericanoService, AmericanoComunService, AmericanoResultadosService, AmericanoRondasService, AmericanoInscripcionesService],
})
export class AmericanoModule {}
