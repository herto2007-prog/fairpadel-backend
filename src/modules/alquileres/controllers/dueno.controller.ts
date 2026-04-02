import {
  Controller,
  Get,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SedesAdminService } from '../../sedes/sedes-admin.service';

@Controller('dueno')
@UseGuards(JwtAuthGuard)
export class DuenoController {
  private readonly logger = new Logger(DuenoController.name);

  constructor(private readonly sedesAdminService: SedesAdminService) {}

  /**
   * Obtener sedes donde el usuario autenticado es dueño
   * Cualquier usuario autenticado puede acceder, el filtro se hace por duenoId
   */
  @Get('mis-sedes')
  async obtenerMisSedes(@Request() req) {
    const userId = req.user.id;
    this.logger.log(`Buscando sedes para duenoId: ${userId}`);
    
    const sedes = await this.sedesAdminService.obtenerSedesDeDueno(userId);
    
    this.logger.log(`Encontradas ${sedes.length} sedes para duenoId: ${userId}`);
    sedes.forEach(s => this.logger.log(`  - ${s.nombre} (duenoId: ${s.duenoId})`));
    
    return sedes;
  }
}
