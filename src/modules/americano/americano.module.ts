import { Module } from '@nestjs/common';
import { AmericanoService } from './americano.service';
import { AmericanoController } from './americano.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, AuthModule, TournamentsModule],
  controllers: [AmericanoController],
  providers: [AmericanoService],
  exports: [AmericanoService],
})
export class AmericanoModule {}
