import { Module } from '@nestjs/common';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';

@Module({
  imports: [PrismaModule],
  providers: [DemoService, TorneoGestionGuard],
  controllers: [DemoController],
  exports: [DemoService],
})
export class DemoModule {}
