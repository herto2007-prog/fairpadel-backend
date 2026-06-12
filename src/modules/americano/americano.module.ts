import { Module } from '@nestjs/common';
import { AmericanoService } from './americano.service';
import { AmericanoComunService } from './americano-comun.service';
import { AmericanoResultadosService } from './americano-resultados.service';
import { AmericanoController } from './americano.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, AuthModule, TournamentsModule],
  controllers: [AmericanoController],
  providers: [AmericanoService, AmericanoComunService, AmericanoResultadosService],
  exports: [AmericanoService, AmericanoComunService, AmericanoResultadosService],
})
export class AmericanoModule {}
