import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AmericanoService } from './americano.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { CreateAmericanoTorneoDto, InscribirJugadorAmericanoDto } from './dto';

@Controller('americano')
export class AmericanoController {
  constructor(private americanoService: AmericanoService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // TORNEOS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('torneos')
  listarTorneos() {
    return this.americanoService.listarTorneosActivos();
  }

  @Get('torneos/:id')
  getTorneo(@Param('id') id: string) {
    return this.americanoService.findById(id);
  }

  @Post('torneos')
  @UseGuards(JwtAuthGuard)
  crearTorneo(
    @GetUser() user: User,
    @Body() dto: CreateAmericanoTorneoDto,
  ) {
    return this.americanoService.crearTorneo(user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INSCRIPCIONES
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('torneos/:id/inscripciones')
  listarInscripciones(@Param('id') torneoId: string) {
    return this.americanoService.listarInscripciones(torneoId);
  }

  @Post('torneos/:id/inscribir')
  @UseGuards(JwtAuthGuard)
  inscribirJugador(
    @Param('id') torneoId: string,
    @Body() dto: InscribirJugadorAmericanoDto,
  ) {
    return this.americanoService.inscribirJugador(torneoId, dto);
  }

  @Post('torneos/:id/desinscribir')
  @UseGuards(JwtAuthGuard)
  desinscribirJugador(
    @Param('id') torneoId: string,
    @Body('jugadorId') jugadorId: string,
    @GetUser() user: User,
  ) {
    return this.americanoService.eliminarInscripcion(torneoId, jugadorId, user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RONDAS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Post('torneos/:id/rondas/iniciar-primera')
  @UseGuards(JwtAuthGuard)
  iniciarPrimeraRonda(
    @Param('id') torneoId: string,
    @GetUser() user: User,
  ) {
    return this.americanoService.iniciarPrimeraRonda(torneoId, user.id);
  }

  @Post('torneos/:id/rondas/siguiente')
  @UseGuards(JwtAuthGuard)
  generarSiguienteRonda(
    @Param('id') torneoId: string,
    @GetUser() user: User,
  ) {
    return this.americanoService.generarSiguienteRonda(torneoId, user.id);
  }

  @Post('torneos/:id/rondas/:rondaId/finalizar')
  @UseGuards(JwtAuthGuard)
  finalizarRonda(
    @Param('id') torneoId: string,
    @Param('rondaId') rondaId: string,
    @GetUser() user: User,
  ) {
    return this.americanoService.finalizarRonda(torneoId, rondaId, user.id);
  }

  @Get('torneos/:id/rondas/:rondaId')
  getRonda(
    @Param('rondaId') rondaId: string,
  ) {
    return this.americanoService.getRondaConParejas(rondaId);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN Y RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('torneos/:id/clasificacion')
  getClasificacion(@Param('id') torneoId: string) {
    return this.americanoService.getClasificacionTorneo(torneoId);
  }

  @Post('torneos/:id/rondas/:rondaId/resultado')
  @UseGuards(JwtAuthGuard)
  registrarResultado(
    @Param('id') torneoId: string,
    @Param('rondaId') rondaId: string,
    @Body() body: {
      parejaAId: string;
      parejaBId: string;
      sets: { gamesEquipoA: number; gamesEquipoB: number }[];
    },
    @GetUser() user: User,
  ) {
    return this.americanoService.registrarResultado(
      torneoId,
      rondaId,
      body.parejaAId,
      body.parejaBId,
      body.sets,
      user.id,
    );
  }
}
