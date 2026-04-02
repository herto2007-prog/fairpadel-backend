import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SedesAdminService } from '../../sedes/sedes-admin.service';

@Controller('dueno')
@UseGuards(JwtAuthGuard)
export class DuenoController {
  constructor(private readonly sedesAdminService: SedesAdminService) {}

  /**
   * Obtener sedes donde el usuario autenticado es dueño
   * Cualquier usuario autenticado puede acceder, el filtro se hace por duenoId
   */
  @Get('mis-sedes')
  async obtenerMisSedes(@Request() req) {
    return this.sedesAdminService.obtenerSedesDeDueno(req.user.id);
  }
}
