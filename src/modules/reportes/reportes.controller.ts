import {
  Controller,
  Get,
  Param,
  UseGuards,
  Res,
  StreamableFile,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { User } from '@prisma/client';
import { ReportesService } from './reportes.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  /**
   * GET /reportes/torneos/:id/inscripciones
   * Descarga el Excel de inscripciones del torneo.
   * Solo quien puede gestionar el torneo (organizador/dueño/coorg/admin).
   */
  @Get('torneos/:id/inscripciones')
  async inscripcionesExcel(
    @Param('id') torneoId: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, user.id);
    if (!puede) {
      throw new ForbiddenException('No tenés permiso para descargar este reporte');
    }

    const { buffer, filename } = await this.reportesService.generarInscripcionesExcel(torneoId);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * GET /reportes/torneos/:id/partidos
   * Descarga el Excel del fixture/partidos del torneo.
   * Solo quien puede gestionar el torneo (organizador/dueño/coorg/admin).
   */
  @Get('torneos/:id/partidos')
  async partidosExcel(
    @Param('id') torneoId: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, user.id);
    if (!puede) {
      throw new ForbiddenException('No tenés permiso para descargar este reporte');
    }

    const { buffer, filename } = await this.reportesService.generarPartidosExcel(torneoId);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }
}
