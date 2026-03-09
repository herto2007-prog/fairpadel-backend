import { Controller, Get } from '@nestjs/common';
import { DateService } from './common/services/date.service';

@Controller()
export class AppController {
  constructor(private readonly dateService: DateService) {}

  @Get('health')
  health() {
    return { 
      status: 'ok', 
      timestamp: this.dateService.formatNow(),
      timezone: 'America/Asuncion (Paraguay)'
    };
  }
}
