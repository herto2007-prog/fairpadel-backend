import { Module } from '@nestjs/common';
import { AmericanoService } from './americano.service';
import { AmericanoComunService } from './americano-comun.service';
import { AmericanoResultadosService } from './americano-resultados.service';
import { AmericanoRondasService } from './americano-rondas.service';
import { AmericanoController } from './americano.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, AuthModule, TournamentsModule],
  controllers: [AmericanoController],
  providers: [AmericanoService, AmericanoComunService, AmericanoResultadosService, AmericanoRondasService],
  exports: [AmericanoService, AmericanoComunService, AmericanoResultadosService, AmericanoRondasService],
})
export class AmericanoModule {}
