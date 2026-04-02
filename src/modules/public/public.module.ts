import { Module } from '@nestjs/common';
import { PublicBracketController } from './public-bracket.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicBracketController],
})
export class PublicModule {}
