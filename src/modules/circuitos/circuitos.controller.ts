import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CircuitosService } from './circuitos.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto/create-circuito.dto';
import { SolicitarInclusionDto, ProcesarSolicitudDto, ConfigurarTorneoCircuitoDto } from './dto/torneo-circuito.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('circuitos')
export class CircuitosController {
  constructor(private readonly circuitosService: CircuitosService) {}

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

  // ═══════════════════════════════════════════════════════════
  // SOLICITUDES DE INCLUSIÓN (Organizadores)
  // ═══════════════════════════════════════════════════════════

  @Post('torneo/:torneoId/solicitar')
  @UseGuards(JwtAuthGuard)
  async solicitarInclusion(
    @Param('torneoId') torneoId: string,
    @Request() req: any,
    @Body() dto: SolicitarInclusionDto,
  ) {
    return this.circuitosService.solicitarInclusion(torneoId, req.user.userId, dto);
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
  // ADMIN - GESTIÓN DE SOLICITUDES
  // ═══════════════════════════════════════════════════════════

  @Get('admin/solicitudes-pendientes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSolicitudesPendientes() {
    return this.circuitosService.getSolicitudesPendientes();
  }

  @Post('admin/solicitud/:id/procesar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async procesarSolicitud(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ProcesarSolicitudDto,
  ) {
    return this.circuitosService.procesarSolicitud(id, req.user.userId, dto);
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
  async calcularClasificados(@Param('id') id: string) {
    return this.circuitosService.calcularClasificados(id);
  }

  @Post('admin/:circuitoId/confirmar-clasificacion/:jugadorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async confirmarClasificacion(
    @Param('circuitoId') circuitoId: string,
    @Param('jugadorId') jugadorId: string,
  ) {
    return this.circuitosService.confirmarClasificacion(circuitoId, jugadorId);
  }
}
