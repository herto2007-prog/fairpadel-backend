import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CircuitosService } from './circuitos.service';
import { MisRankingsService } from './mis-rankings.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto/create-circuito.dto';
import { CrearMiRankingDto, EditarMiRankingDto, SumarTorneoDto } from './dto/mis-rankings.dto';
import { AsignarTorneoDirectoDto, ConfigurarTorneoCircuitoDto } from './dto/torneo-circuito.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('circuitos')
export class CircuitosController {
  constructor(
    private readonly circuitosService: CircuitosService,
    private readonly misRankingsService: MisRankingsService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // MIS RANKINGS (organizador, autoservicio) — DECLARAR ANTES de
  // las rutas :id para que Nest no las capture como id.
  // ═══════════════════════════════════════════════════════════

  @Get('validar-nombre')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async validarNombre(@Query('nombre') nombre: string) {
    return this.misRankingsService.validarNombre(nombre);
  }

  @Get('mis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async misRankings(@GetUser() user: any) {
    return this.misRankingsService.listar(user.userId);
  }

  @Post('mis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async crearMiRanking(@GetUser() user: any, @Body() dto: CrearMiRankingDto) {
    return this.misRankingsService.crear(user.userId, dto);
  }

  @Put('mis/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async editarMiRanking(@GetUser() user: any, @Param('id') id: string, @Body() dto: EditarMiRankingDto) {
    return this.misRankingsService.editar(user.userId, id, dto);
  }

  @Delete('mis/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async borrarMiRanking(@GetUser() user: any, @Param('id') id: string) {
    return this.misRankingsService.borrar(user.userId, id);
  }

  @Get('mis/:id/torneos-disponibles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async torneosDisponibles(@GetUser() user: any, @Param('id') id: string) {
    return this.misRankingsService.torneosDisponibles(user.userId, id);
  }

  @Post('mis/:id/torneos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async sumarTorneo(@GetUser() user: any, @Param('id') id: string, @Body() dto: SumarTorneoDto) {
    return this.misRankingsService.sumarTorneo(user.userId, id, dto.torneoId);
  }

  @Delete('mis/:id/torneos/:torneoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async quitarTorneo(@GetUser() user: any, @Param('id') id: string, @Param('torneoId') torneoId: string) {
    return this.misRankingsService.quitarTorneo(user.userId, id, torneoId);
  }

  // ═══════════════════════════════════════════════════════════
  // RUTAS PÚBLICAS
  // ═══════════════════════════════════════════════════════════

  @Get()
  async findAll() {
    return this.circuitosService.findAll();
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.circuitosService.findBySlug(slug);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.circuitosService.findOne(id);
  }

  @Get(':id/ranking')
  async getRanking(
    @Param('id') id: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    return this.circuitosService.getRankingCircuito(id, categoriaId);
  }

  @Get(':id/torneos')
  async getTorneos(@Param('id') id: string) {
    return this.circuitosService.getTorneosDeCircuito(id);
  }

  @Get(':id/categorias-ranking')
  async getCategoriasRanking(@Param('id') id: string) {
    return this.circuitosService.getCategoriasDelCircuito(id);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN - GESTIÓN DE CIRCUITOS
  // ═══════════════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateCircuitoDto) {
    return this.circuitosService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateCircuitoDto) {
    return this.circuitosService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.circuitosService.remove(id);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN - GESTIÓN DE TORNEOS (ASIGNACIÓN DIRECTA)
  // ═══════════════════════════════════════════════════════════

  @Get('admin/torneos-disponibles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getTorneosDisponibles(@Query('circuitoId') circuitoId: string) {
    return this.circuitosService.getTorneosDisponibles(circuitoId);
  }

  @Post('admin/asignar-torneo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async asignarTorneoDirecto(
    @Request() req: any,
    @Body() dto: AsignarTorneoDirectoDto,
  ) {
    return this.circuitosService.asignarTorneoDirecto(req.user.userId, dto);
  }

  @Delete('admin/:circuitoId/torneo/:torneoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async eliminarTorneoDeCircuito(
    @Param('circuitoId') circuitoId: string,
    @Param('torneoId') torneoId: string,
  ) {
    return this.circuitosService.eliminarTorneoDeCircuito(circuitoId, torneoId);
  }

  @Post('admin/torneo-circuito/:id/configurar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async configurarTorneoCircuito(
    @Param('id') id: string,
    @Body() dto: ConfigurarTorneoCircuitoDto,
  ) {
    return this.circuitosService.configurarTorneoCircuito(id, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN - CLASIFICADOS
  // ═══════════════════════════════════════════════════════════

  @Post('admin/:id/calcular-clasificados')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async calcularClasificados(
    @Param('id') id: string,
    @Body('categoryId') categoryId: string,
  ) {
    return this.circuitosService.calcularClasificados(id, categoryId);
  }

  @Post('admin/clasificado/:id/asistencia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async marcarAsistencia(
    @Param('id') id: string,
    @Body('asistencia') asistencia: boolean,
  ) {
    return this.circuitosService.marcarAsistencia(id, asistencia);
  }

  @Get(':id/clasificados')
  async getClasificados(
    @Param('id') id: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.circuitosService.getClasificados(id, categoryId);
  }

  @Post('admin/:id/asignar-final')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async asignarTorneoFinal(
    @Param('id') id: string,
    @Body('torneoId') torneoId: string,
  ) {
    return this.circuitosService.asignarTorneoFinal(id, torneoId);
  }

  @Delete('admin/:id/quitar-final')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async quitarTorneoFinal(@Param('id') id: string) {
    return this.circuitosService.quitarTorneoFinal(id);
  }
}
