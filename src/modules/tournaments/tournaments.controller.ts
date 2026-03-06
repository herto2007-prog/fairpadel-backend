import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  getCategories() {
    return this.tournamentsService.getCategories();
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
}
