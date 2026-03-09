import { Module } from '@nestjs/common';
import { ModalidadesController } from './modalidades.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModalidadesController],
})
export class ModalidadesModule {}
