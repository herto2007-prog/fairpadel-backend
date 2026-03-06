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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

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
  findMyTournaments(@GetUser('userId') userId: string) {
    return this.tournamentsService.findMyTournaments(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tournamentsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @GetUser('userId') userId: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, userId, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(
    @Param('id') id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.tournamentsService.publish(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.tournamentsService.remove(id, userId);
  }
}
