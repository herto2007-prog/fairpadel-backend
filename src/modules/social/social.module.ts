import { Module } from '@nestjs/common';
import { JugadoresController } from './controllers/jugadores.controller';
import { JugadoresService } from './services/jugadores.service';
import { SeguimientoController } from './controllers/seguimiento.controller';
import { SeguimientoService } from './services/seguimiento.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JugadoresController, SeguimientoController],
  providers: [JugadoresService, SeguimientoService],
  exports: [JugadoresService, SeguimientoService],
})
export class SocialModule {}
