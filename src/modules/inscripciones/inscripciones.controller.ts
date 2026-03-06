import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto, ConfirmarInscripcionDto } from './dto/update-inscripcion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { InscripcionEstado } from '@prisma/client';

@Controller('inscripciones')
@UseGuards(JwtAuthGuard)
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Post()
  create(@Body() dto: CreateInscripcionDto, @GetUser() user: User) {
    return this.inscripcionesService.create(dto, user.id);
  }

  @Get('my')
  findMyInscripciones(@GetUser() user: User) {
    return this.inscripcionesService.findMyInscripciones(user.id);
  }

  @Get('tournament/:tournamentId')
  findByTournament(
    @Param('tournamentId') tournamentId: string,
    @GetUser() user: User
  ) {
    return this.inscripcionesService.findByTournament(tournamentId, user.id);
  }

  @Get()
  findAll(
    @Query('tournamentId') tournamentId: string,
    @Query('estado') estado: InscripcionEstado,
    @GetUser() user: User
  ) {
    return this.inscripcionesService.findAll({
      tournamentId,
      jugadorId: user.id,
      estado
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inscripcionesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInscripcionDto,
    @GetUser() user: User
  ) {
    return this.inscripcionesService.update(id, dto, user.id);
  }

  @Patch(':id/confirmar')
  confirmar(
    @Param('id') id: string,
    @Body() dto: ConfirmarInscripcionDto,
    @GetUser() user: User
  ) {
    return this.inscripcionesService.confirmar(id, dto, user.id);
  }

  @Patch(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @GetUser() user: User
  ) {
    return this.inscripcionesService.cancelar(id, user.id, motivo);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.inscripcionesService.remove(id, user.id);
  }
}
