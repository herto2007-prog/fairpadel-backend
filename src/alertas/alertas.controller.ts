import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  /**
   * GET /api/alertas — My alerts (premium only)
   */
  @Get()
  async getMisAlertas(@Request() req: any) {
    return this.alertasService.getMisAlertas(req.user.id);
  }

  /**
   * POST /api/alertas — Create/activate alert (premium only)
   */
  @Post()
  async crearAlerta(@Request() req: any, @Body() dto: CreateAlertaDto) {
    return this.alertasService.crearAlerta(req.user.id, dto);
  }

  /**
   * PUT /api/alertas/:id — Update alert (premium only)
   */
  @Put(':id')
  async actualizarAlerta(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertaDto,
  ) {
    return this.alertasService.actualizarAlerta(req.user.id, id, dto);
  }

  /**
   * DELETE /api/alertas/:id — Delete alert (premium only)
   */
  @Delete(':id')
  async eliminarAlerta(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.alertasService.eliminarAlerta(req.user.id, id);
  }
}
