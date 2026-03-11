import { Module } from '@nestjs/common';
import { DemoPublicController } from './demo-public.controller';
import { DemoSeedController } from './demo-seed.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DemoPublicController, DemoSeedController],
})
export class DemoPublicModule {}
