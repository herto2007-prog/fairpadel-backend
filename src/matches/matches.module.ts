import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { FixtureService } from './fixture.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [MatchesService, FixtureService],
  exports: [MatchesService, FixtureService],
})
export class MatchesModule {}