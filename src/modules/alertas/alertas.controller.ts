import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlertasService } from './alertas.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';

@Controller('alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post()
  crear(@Request() req: any, @Body() dto: CreateAlertaDto) {
    return this.alertasService.crearOActualizar(req.user.userId, dto);
  }

  @Get()
  listar(@Request() req: any) {
    return this.alertasService.listarMisAlertas(req.user.userId);
  }

  @Delete(':id')
  eliminar(@Request() req: any, @Param('id') id: string) {
    return this.alertasService.eliminar(req.user.userId, id);
  }
}
