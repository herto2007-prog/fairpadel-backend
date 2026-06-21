import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, EmailModule, ConfigModule, PushModule],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
