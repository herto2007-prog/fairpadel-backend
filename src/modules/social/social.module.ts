import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { JugadoresController } from './controllers/jugadores.controller';
import { JugadoresService } from './services/jugadores.service';
import { SeguimientoController } from './controllers/seguimiento.controller';
import { SeguimientoService } from './services/seguimiento.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JugadoresController, SeguimientoController],
  providers: [
    JugadoresService,
    SeguimientoService,
    // Pipe local que permite parámetros extra (como _t para cache busting)
    // Anula el forbidNonWhitelisted del pipe global solo para este módulo
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    },
  ],
  exports: [JugadoresService, SeguimientoService],
})
export class SocialModule {}
