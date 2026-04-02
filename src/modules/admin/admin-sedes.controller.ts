import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SedesAdminService } from '../sedes/sedes-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AsignarDuenoDto {
  userId: string;
}

interface AsignarEncargadoDto {
  userId: string;
}

@Controller('admin/sedes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSedesController {
  constructor(private readonly sedesAdminService: SedesAdminService) {}

  /**
   * Listar todas las sedes con dueños y estado de suscripción
   */
  @Get()
  async obtenerSedes() {
    return this.sedesAdminService.obtenerSedesConDuenos();
  }

  /**
   * Asignar dueño a una sede
   */
  @Post(':sedeId/asignar-dueno')
  async asignarDueno(
    @Param('sedeId') sedeId: string,
    @Body() dto: AsignarDuenoDto,
  ) {
    return this.sedesAdminService.asignarDueno({
      sedeId,
      userId: dto.userId,
    });
  }

  /**
   * Asignar encargado a una sede
   */
  @Post(':sedeId/asignar-encargado')
  async asignarEncargado(
    @Param('sedeId') sedeId: string,
    @Body() dto: AsignarEncargadoDto,
  ) {
    return this.sedesAdminService.asignarEncargado({
      sedeId,
      userId: dto.userId,
    });
  }

  /**
   * Obtener sedes donde el usuario autenticado es dueño
   * NOTA: Esta ruta es pública para cualquier usuario autenticado (no solo admin)
   */
  @Get('mis-sedes/dueno')
  @UseGuards(JwtAuthGuard)  // Sobrescribe los guards de la clase - solo requiere login
  async obtenerMisSedesComoDueno(@Request() req) {
    return this.sedesAdminService.obtenerSedesDeDueno(req.user.id);
  }
}
