import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TournamentRoleGuard } from '../auth/guards/tournament-role.guard';

@Controller('inscripciones')
@UseGuards(JwtAuthGuard)
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Post()
  create(@Body() createInscripcionDto: CreateInscripcionDto, @Request() req) {
    return this.inscripcionesService.create(createInscripcionDto, req.user.id);
  }

  @Get('mis-inscripciones')
  misinscripciones(@Request() req) {
    return this.inscripcionesService.findByUser(req.user.id);
  }

  @Get('torneo/:tournamentId')
  findByTournament(
    @Param('tournamentId') tournamentId: string,
    @Query('estado') estado: string,
    @Request() req,
  ) {
    return this.inscripcionesService.findByTournament(
      tournamentId,
      req.user.id,
      req.user.roles || [],
      estado,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.inscripcionesService.findOneAuthorized(
      id,
      req.user.id,
      req.user.roles || [],
    );
  }

  @Put(':id/cancelar')
  cancelar(@Param('id') id: string, @Request() req) {
    return this.inscripcionesService.cancelar(id, req.user.id);
  }

  @Post(':id/comprobante')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
    }),
  )
  subirComprobante(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { comprobanteUrl?: string },
    @Request() req,
  ) {
    return this.inscripcionesService.subirComprobante(
      id,
      req.user.id,
      file,
      body.comprobanteUrl,
    );
  }

  // ═══════════════════════════════════════════
  // GESTIÓN DE PAGOS (organizador / admin)
  // ═══════════════════════════════════════════

  @Put('torneo/:tournamentId/inscripcion/:id/confirmar-pago')
  @UseGuards(TournamentRoleGuard)
  confirmarPago(@Param('id') id: string) {
    return this.inscripcionesService.confirmarPagoCompleto(id);
  }

  @Put('torneo/:tournamentId/inscripcion/:id/rechazar-pago')
  @UseGuards(TournamentRoleGuard)
  rechazarPago(
    @Param('id') id: string,
    @Body() body: { motivo?: string },
  ) {
    return this.inscripcionesService.rechazarPagoCompleto(id, body.motivo);
  }
}
