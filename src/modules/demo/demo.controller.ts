import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Get,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { DemoService } from './demo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class LlenarTorneoDto {
  @IsNumber()
  @IsOptional()
  @Min(12)
  @Max(32)
  parejasPorCategoria?: number = 16;

  @IsEnum(['EQUILIBRADA', 'ALEATORIA', 'REALISTA'])
  @IsOptional()
  distribucion?: 'EQUILIBRADA' | 'ALEATORIA' | 'REALISTA' = 'REALISTA';
}

@Controller('admin/demo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class DemoController {
  constructor(private demoService: DemoService) {}

  /**
   * POST /admin/demo/torneos/:id/llenar
   * Llena un torneo con inscripciones de jugadores demo
   */
  @Post('torneos/:id/llenar')
  async llenarTorneo(
    @Param('id') tournamentId: string,
    @Body() dto: LlenarTorneoDto,
  ) {
    return this.demoService.llenarTorneo(tournamentId, dto);
  }

  /**
   * DELETE /admin/demo/torneos/:id/limpiar
   * Elimina todas las inscripciones demo de un torneo
   */
  @Delete('torneos/:id/limpiar')
  async limpiarTorneo(@Param('id') tournamentId: string) {
    return this.demoService.limpiarTorneo(tournamentId);
  }

  /**
   * GET /admin/demo/status
   * Verifica estado del sistema demo (cuántos jugadores hay, etc.)
   */
  @Get('status')
  async getStatus() {
    const countMasc = await this.demoService.countJugadores('MASCULINO');
    const countFem = await this.demoService.countJugadores('FEMENINO');
    
    return {
      message: 'Sistema Demo',
      jugadoresDisponibles: {
        masculinos: countMasc,
        femeninos: countFem,
        total: countMasc + countFem,
      },
      seedEjecutado: countMasc > 0 && countFem > 0,
      endpoints: [
        'POST /admin/demo/torneos/:id/llenar - Llenar torneo con inscripciones demo',
        'DELETE /admin/demo/torneos/:id/limpiar - Limpiar inscripciones demo',
      ],
      notas: [
        'Las inscripciones demo se marcan con nota "DEMO" para fácil identificación',
        'Los jugadores demo tienen documentos que empiezan con DEMO-M- o DEMO-F-',
        'Se crean con estados mixtos: 60% CONFIRMADA, 30% PENDIENTE_PAGO, 10% PENDIENTE_CONFIRMACION',
        'Las inscripciones confirmadas incluyen pago ficticio',
        'IMPORTANTE: Ejecutar seed-demo.ts primero para crear los 400 jugadores de prueba',
      ],
    };
  }
}
