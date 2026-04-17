import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /stats/global
   * Estadísticas globales públicas del sistema.
   * Ideal para landing page y dashboard público.
   */
  @Get('global')
  @Public()
  async getGlobal() {
    const data = await this.statsService.obtenerStatsGlobales();
    return { success: true, data };
  }
}
