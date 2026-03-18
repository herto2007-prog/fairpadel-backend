import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Get,
  Query,
  Put,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { ProgramacionService, ResultadoProgramacion, PartidoAsignado } from './programacion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface CalcularProgramacionDto {
  categoriasSorteadas: string[];
  fechaInicio?: string;
  canchasFinales?: string[];
  horaInicioFinales?: string;
  horaFinFinales?: string;
}

interface AplicarProgramacionDto {
  asignaciones: PartidoAsignado[];
}

@Controller('programacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class ProgramacionController {
  constructor(private readonly programacionService: ProgramacionService) {}

  /**
   * POST /programacion/torneos/:id/calcular
   * Calcula la programación inteligente para un torneo
   */
  @Post('torneos/:id/calcular')
  async calcularProgramacion(
    @Param('id') tournamentId: string,
    @Body() dto: CalcularProgramacionDto,
  ): Promise<ResultadoProgramacion> {
    return this.programacionService.calcularProgramacion(
      tournamentId,
      dto.categoriasSorteadas,
      dto.fechaInicio,
      dto.canchasFinales,
      dto.horaInicioFinales,
      dto.horaFinFinales,
    );
  }

  /**
   * POST /programacion/torneos/:id/aplicar
   * Aplica la programación calculada a los partidos
   */
  @Post('torneos/:id/aplicar')
  async aplicarProgramacion(
    @Param('id') tournamentId: string,
    @Body() dto: AplicarProgramacionDto,
  ): Promise<{ success: boolean; message: string; totalAsignados: number }> {
    await this.programacionService.aplicarProgramacion(
      tournamentId,
      dto.asignaciones,
    );

    return {
      success: true,
      message: 'Programación aplicada exitosamente',
      totalAsignados: dto.asignaciones.length,
    };
  }

  /**
   * GET /programacion/torneos/:id/preview
   * Obtiene una vista previa de la programación sin aplicarla
   */
  @Get('torneos/:id/preview')
  async previewProgramacion(
    @Param('id') tournamentId: string,
    @Query('categorias') categoriasParam: string,
  ): Promise<ResultadoProgramacion> {
    const categoriasSorteadas = categoriasParam ? categoriasParam.split(',') : [];
    
    return this.programacionService.calcularProgramacion(
      tournamentId,
      categoriasSorteadas,
    );
  }

  /**
   * PUT /programacion/partidos/:partidoId
   * Actualiza la programación de un partido específico
   */
  @Put('partidos/:partidoId')
  async actualizarProgramacionPartido(
    @Param('partidoId') partidoId: string,
    @Body() dto: {
      fecha: string;
      horaInicio: string;
      torneoCanchaId: string;
    },
  ) {
    if (!dto.fecha || !dto.horaInicio || !dto.torneoCanchaId) {
      throw new BadRequestException('Fecha, hora y cancha son requeridos');
    }

    await this.programacionService.actualizarProgramacionPartido(
      partidoId,
      dto.fecha,
      dto.horaInicio,
      dto.torneoCanchaId,
    );

    return {
      success: true,
      message: 'Partido actualizado correctamente',
    };
  }

  /**
   * DELETE /programacion/partidos/:partidoId
   * Desprograma un partido (limpia fecha, hora y cancha)
   */
  @Delete('partidos/:partidoId')
  async desprogramarPartido(
    @Param('partidoId') partidoId: string,
  ) {
    await this.programacionService.desprogramarPartido(partidoId);

    return {
      success: true,
      message: 'Partido desprogramado correctamente',
    };
  }

  /**
   * GET /programacion/torneos/:id/canchas
   * Obtiene las canchas disponibles para el torneo con sus horarios
   */
  @Get('torneos/:id/canchas')
  async getCanchasDisponibles(
    @Param('id') tournamentId: string,
  ) {
    return this.programacionService.getCanchasDisponibles(tournamentId);
  }
}
