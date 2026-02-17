import { Controller, Get, Param, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { LogrosService } from './logros.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('logros')
export class LogrosController {
  constructor(private readonly logrosService: LogrosService) {}

  /**
   * GET /api/logros — List all logros (public)
   */
  @Get()
  async getAll() {
    return this.logrosService.getAll();
  }

  /**
   * GET /api/logros/mis-logros — My logros with unlock status (auth required)
   */
  @UseGuards(JwtAuthGuard)
  @Get('mis-logros')
  async getMisLogros(@Request() req: any) {
    return this.logrosService.getMisLogros(req.user.id);
  }

  /**
   * GET /api/logros/usuario/:id — Public logros of a user
   */
  @Get('usuario/:id')
  async getLogrosUsuario(@Param('id', ParseUUIDPipe) id: string) {
    return this.logrosService.getLogrosPublicos(id);
  }
}
