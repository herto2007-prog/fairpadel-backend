import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SedeGestionGuard } from '../../common/guards/sede-gestion.guard';
import { User } from '@prisma/client';

@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Get()
  findAll(@Query('ciudad') ciudad?: string) {
    return this.sedesService.findAll(ciudad);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sedesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizador', 'dueño')
  create(@Body() createSedeDto: CreateSedeDto, @GetUser() user: User) {
    return this.sedesService.create(createSedeDto, user.id);
  }

  @Patch(':sedeId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  update(@Param('sedeId') id: string, @Body() updateSedeDto: UpdateSedeDto) {
    return this.sedesService.update(id, updateSedeDto);
  }

  @Delete(':sedeId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  remove(@Param('sedeId') id: string) {
    return this.sedesService.remove(id);
  }

  // ============ CANCHAS ============

  @Get(':id/canchas')
  findCanchas(@Param('id') sedeId: string) {
    return this.sedesService.findCanchasBySede(sedeId);
  }

  @Post(':sedeId/canchas')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  createCancha(@Param('sedeId') sedeId: string, @Body() createCanchaDto: CreateCanchaDto) {
    return this.sedesService.createCancha(sedeId, createCanchaDto);
  }

  @Patch('canchas/:canchaId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  updateCancha(@Param('canchaId') canchaId: string, @Body() updateCanchaDto: Partial<CreateCanchaDto>) {
    return this.sedesService.updateCancha(canchaId, updateCanchaDto);
  }

  @Delete('canchas/:canchaId')
  @UseGuards(JwtAuthGuard, SedeGestionGuard)
  removeCancha(@Param('canchaId') canchaId: string) {
    return this.sedesService.removeCancha(canchaId);
  }
}
