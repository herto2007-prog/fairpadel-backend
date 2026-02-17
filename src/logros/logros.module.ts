import { Module } from '@nestjs/common';
import { LogrosController } from './logros.controller';
import { LogrosService } from './logros.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { FeedModule } from '../feed/feed.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, FeedModule],
  controllers: [LogrosController],
  providers: [LogrosService],
  exports: [LogrosService],
})
export class LogrosModule {}
