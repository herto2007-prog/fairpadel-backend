import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  create(@Body() createTournamentDto: CreateTournamentDto, @Request() req) {
    return this.tournamentsService.create(createTournamentDto, req.user.id);
  }

  @Get()
  findAll(
    @Query('pais') pais?: string,
    @Query('ciudad') ciudad?: string,
    @Query('estado') estado?: string,
  ) {
    return this.tournamentsService.findAll({ pais, ciudad, estado });
  }

  @Get('categories')
  obtenerCategorias() {
    return this.tournamentsService.obtenerCategorias();
  }

  @Get('my-tournaments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  findMyTournaments(@Request() req) {
    return this.tournamentsService.findMyTournaments(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
    @Request() req,
  ) {
    return this.tournamentsService.update(id, updateTournamentDto, req.user.id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  publish(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.publish(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  remove(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.remove(id, req.user.id);
  }
}