import { Controller, Post, Get, Param, Body, UseGuards, Patch } from '@nestjs/common';
import { FixtureService, GenerarFixtureData } from './fixture.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('fixture')
@UseGuards(JwtAuthGuard)
export class FixtureController {
  constructor(private readonly fixtureService: FixtureService) {}

  @Post('generar')
  generar(
    @Body() data: GenerarFixtureData,
    @GetUser() user: User,
  ) {
    return this.fixtureService.generarFixture(data, user.id);
  }

  @Post(':id/publicar')
  publicar(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.fixtureService.publicarFixture(id, user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.fixtureService.getFixtureById(id);
  }

  @Get('tournament/:tournamentId/category/:categoryId')
  getFixtureActivo(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.fixtureService.getFixtureActivo(tournamentId, categoryId);
  }
}
