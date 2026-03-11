import { Module } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BracketService],
  exports: [BracketService],
})
export class BracketModule {}
