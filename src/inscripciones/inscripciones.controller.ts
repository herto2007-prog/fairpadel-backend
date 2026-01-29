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
} from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    @Query('estado') estado?: string,
  ) {
    return this.inscripcionesService.findByTournament(tournamentId, estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inscripcionesService.findOne(id);
  }

  @Put(':id/cancelar')
  cancelar(@Param('id') id: string, @Request() req) {
    return this.inscripcionesService.cancelar(id, req.user.id);
  }

  @Post(':id/comprobante')
  subirComprobante(
    @Param('id') id: string,
    @Body() body: { comprobanteUrl: string },
  ) {
    return this.inscripcionesService.subirComprobante(id, body.comprobanteUrl);
  }
}