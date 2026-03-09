import { Module } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { SedesAdminController } from './sedes-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SedesController, SedesAdminController],
  providers: [SedesService],
  exports: [SedesService],
})
export class SedesModule {}
