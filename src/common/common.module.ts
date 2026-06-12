import { Global, Module } from '@nestjs/common';
import { DateService } from './services/date.service';
import { ComisionService } from './services/comision.service';
import { AuditoriaAccionesService } from './services/auditoria-acciones.service';

@Global()
@Module({
  providers: [DateService, ComisionService, AuditoriaAccionesService],
  exports: [DateService, ComisionService, AuditoriaAccionesService],
})
export class CommonModule {}
