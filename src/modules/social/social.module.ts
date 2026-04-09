import { Module } from '@nestjs/common';
import { JugadoresController } from './controllers/jugadores.controller';
import { JugadoresService } from './services/jugadores.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JugadoresController],
  providers: [JugadoresService],
  exports: [JugadoresService],
})
export class SocialModule {}
