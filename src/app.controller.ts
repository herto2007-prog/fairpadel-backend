import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    const now = new Date();
    // Formatear a hora de Paraguay (UTC-3)
    const paraguayTime = now.toLocaleString('es-PY', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return { 
      status: 'ok', 
      timestamp: paraguayTime,
      timezone: 'America/Asuncion (Paraguay)'
    };
  }
}
