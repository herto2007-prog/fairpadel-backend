import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RankingsModule } from '../rankings/rankings.module';
import { CategoriasModule } from '../categorias/categorias.module';

@Module({
  imports: [PrismaModule, RankingsModule, CategoriasModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}