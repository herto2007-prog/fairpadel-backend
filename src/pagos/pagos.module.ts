import { Module } from '@nestjs/common';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { BancardService } from './bancard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PagosController],
  providers: [PagosService, BancardService],
  exports: [PagosService, BancardService],
})
export class PagosModule {}