import { Global, Module } from '@nestjs/common';
import { DateService } from './services/date.service';
import { ComisionService } from './services/comision.service';

@Global()
@Module({
  providers: [DateService, ComisionService],
  exports: [DateService, ComisionService],
})
export class CommonModule {}
