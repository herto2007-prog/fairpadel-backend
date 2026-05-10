import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get('categories')
  getCategories(@Query('tipo') tipo?: string) {
    return this.tournamentsService.getCategories(tipo);
  }

  @Get('my-tournaments')
  @UseGuards(JwtAuthGuard)
  findMyTournaments(@GetUser() user: User) {
    return this.tournamentsService.findByOrganizador(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @GetUser() user: User,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, user.id, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.tournamentsService.publish(id, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.tournamentsService.remove(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════
  // CO-ORGANIZADORES
  // ═══════════════════════════════════════════════════════════

  @Get(':id/coorganizadores')
  @UseGuards(JwtAuthGuard)
  async listarCoorganizadores(@Param('id') id: string) {
    return this.tournamentsService.listarCoorganizadores(id);
  }

  @Post(':id/coorganizadores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async agregarCoorganizador(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.tournamentsService.agregarCoorganizador(id, userId);
  }

  @Delete(':id/coorganizadores/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async removerCoorganizador(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.tournamentsService.removerCoorganizador(id, userId);
  }
}
