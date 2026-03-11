import { Module } from '@nestjs/common';
import { DemoPublicController } from './demo-public.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DemoPublicController],
})
export class DemoPublicModule {}
