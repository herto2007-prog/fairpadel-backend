import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  listar(
    @Query('tournamentId') tournamentId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.matchesService.listarPartidos(tournamentId, categoryId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.matchesService.getMatchById(id);
  }

  @Patch(':id/resultado')
  registrarResultado(
    @Param('id') id: string,
    @Body() dto: RegistrarResultadoDto,
    @GetUser() user: User,
  ) {
    return this.matchesService.registrarResultado(id, dto, user.id);
  }

  @Patch(':id/programar')
  programar(
    @Param('id') id: string,
    @Body() data: {
      canchaId?: string;
      canchaNombre?: string;
      fechaProgramada?: Date;
      horaProgramada?: string;
      horaFinEstimada?: string;
    },
    @GetUser() user: User,
  ) {
    return this.matchesService.programarPartido(id, data, user.id);
  }

  @Patch(':id/wo')
  registrarWO(
    @Param('id') id: string,
    @Body('parejaGanadoraId') parejaGanadoraId: string,
    @GetUser() user: User,
  ) {
    return this.matchesService.registrarWO(id, parejaGanadoraId, user.id);
  }
}
