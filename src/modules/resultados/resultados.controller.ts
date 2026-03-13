import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ResultadosService } from './resultados.service';
import { RegistrarResultadoDto, RegistrarPuntoDto, IniciarPartidoDto, FinalizarPartidoDto } from './dto/registrar-resultado.dto';
import { ResultadoEspecialDto } from './dto/resultado-especial.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/resultados')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('organizador', 'admin', 'ayudante')
export class ResultadosController {
  constructor(private readonly resultadosService: ResultadosService) {}

  // ═══════════════════════════════════════════════════════════
  // ENDPOINTS - CARGA DIRECTA DE RESULTADOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Registra el resultado completo de un partido (post-partido)
   * POST /admin/resultados/matches/:matchId/resultado
   */
  @Post('matches/:matchId/resultado')
  @HttpCode(HttpStatus.OK)
  async registrarResultado(
    @Param('matchId') matchId: string,
    @Body() dto: RegistrarResultadoDto,
  ) {
    return this.resultadosService.registrarResultado(matchId, dto);
  }

  /**
   * Registra un resultado especial (retiro, descalificación, WO)
   * POST /admin/resultados/matches/:matchId/resultado-especial
   */
  @Post('matches/:matchId/resultado-especial')
  @HttpCode(HttpStatus.OK)
  async registrarResultadoEspecial(
    @Param('matchId') matchId: string,
    @Body() dto: ResultadoEspecialDto,
  ) {
    return this.resultadosService.registrarResultadoEspecial(matchId, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // ENDPOINTS - MARCADOR EN VIVO
  // ═══════════════════════════════════════════════════════════

  /**
   * Inicia un partido en modo "en juego" con marcador en vivo
   * POST /admin/resultados/matches/:matchId/iniciar
   */
  @Post('matches/:matchId/iniciar')
  @HttpCode(HttpStatus.OK)
  async iniciarPartido(
    @Param('matchId') matchId: string,
    @Body() dto: IniciarPartidoDto,
  ) {
    return this.resultadosService.iniciarPartido(matchId, dto);
  }

  /**
   * Obtiene el marcador actual de un partido
   * GET /admin/resultados/matches/:matchId/marcador
   */
  @Get('matches/:matchId/marcador')
  async obtenerMarcador(@Param('matchId') matchId: string) {
    return this.resultadosService.obtenerMarcador(matchId);
  }

  /**
   * Registra un punto en el marcador en vivo
   * POST /admin/resultados/matches/:matchId/punto
   */
  @Post('matches/:matchId/punto')
  @HttpCode(HttpStatus.OK)
  async registrarPunto(
    @Param('matchId') matchId: string,
    @Body() dto: RegistrarPuntoDto,
  ) {
    return this.resultadosService.registrarPunto(matchId, dto);
  }

  /**
   * Deshace el último punto registrado (para correcciones)
   * POST /admin/resultados/matches/:matchId/deshacer
   */
  @Post('matches/:matchId/deshacer')
  @HttpCode(HttpStatus.OK)
  async deshacerUltimoPunto(@Param('matchId') matchId: string) {
    return this.resultadosService.deshacerUltimoPunto(matchId);
  }

  /**
   * Finaliza un partido desde el modo en vivo
   * POST /admin/resultados/matches/:matchId/finalizar
   */
  @Post('matches/:matchId/finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizarPartido(
    @Param('matchId') matchId: string,
    @Body() dto: FinalizarPartidoDto,
  ) {
    return this.resultadosService.finalizarPartido(matchId, dto);
  }
}
