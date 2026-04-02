import { Controller, Post, Body, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CanchasSorteoService } from './canchas-sorteo.service';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  CerrarInscripcionesSortearDto,
} from './dto/canchas-sorteo.dto';

@Controller('admin/canchas-sorteo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('organizador', 'admin')
export class CanchasSorteoController {
  constructor(private readonly canchasSorteoService: CanchasSorteoService) {}

  /**
   * PASO 1.a: Configurar horarios de finales
   * POST /admin/canchas-sorteo/finales
   */
  @Post('finales')
  async configurarFinales(@Body() dto: ConfigurarFinalesDto) {
    return this.canchasSorteoService.configurarFinales(dto);
  }

  /**
   * PASO 1.b: Configurar días de juego
   * POST /admin/canchas-sorteo/dias
   */
  @Post('dias')
  async configurarDiaJuego(@Body() dto: ConfigurarDiaJuegoDto) {
    return this.canchasSorteoService.configurarDiaJuego(dto);
  }

  /**
   * Obtiene las canchas asignadas al torneo
   * GET /admin/canchas-sorteo/:tournamentId/canchas
   */
  @Get(':tournamentId/canchas')
  async obtenerCanchas(@Param('tournamentId') tournamentId: string) {
    return this.canchasSorteoService.obtenerCanchas(tournamentId);
  }

  /**
   * Obtiene configuración actual del torneo
   * GET /admin/canchas-sorteo/:tournamentId/configuracion
   */
  @Get(':tournamentId/configuracion')
  async obtenerConfiguracion(@Param('tournamentId') tournamentId: string) {
    return this.canchasSorteoService.obtenerConfiguracion(tournamentId);
  }

  /**
   * PASO 2: Calcular slots necesarios antes de cerrar
   * POST /admin/canchas-sorteo/calcular-slots
   */
  @Post('calcular-slots')
  async calcularSlotsNecesarios(
    @Body('tournamentId') tournamentId: string,
    @Body('categoriasIds') categoriasIds: string[],
  ) {
    return this.canchasSorteoService.calcularSlotsNecesarios(
      tournamentId,
      categoriasIds,
    );
  }

  /**
   * PASO 2: Cerrar inscripciones y sortear
   * POST /admin/canchas-sorteo/cerrar-y-sortear
   */
  @Post('cerrar-y-sortear')
  async cerrarInscripcionesYsortear(@Body() dto: CerrarInscripcionesSortearDto) {
    return this.canchasSorteoService.cerrarInscripcionesYsortear(dto);
  }

  /**
   * Eliminar un día de juego y sus slots
   * DELETE /admin/canchas-sorteo/dias/:diaId
   */
  @Delete('dias/:diaId')
  async eliminarDia(@Param('diaId') diaId: string) {
    return this.canchasSorteoService.eliminarDia(diaId);
  }

  /**
   * AUDITORÍA: Validar integridad del fixture
   * GET /admin/canchas-sorteo/:tournamentId/auditar
   */
  @Get(':tournamentId/auditar')
  async auditarFixture(@Param('tournamentId') tournamentId: string) {
    return this.canchasSorteoService.auditarFixture(tournamentId);
  }
}
