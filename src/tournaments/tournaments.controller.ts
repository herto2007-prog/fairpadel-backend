import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CloudinaryService } from '../fotos/cloudinary.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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
    @Query('nombre') nombre?: string,
  ) {
    return this.tournamentsService.findAll({ pais, ciudad, estado, nombre });
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

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tournamentsService.findBySlug(slug);
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

  @Post(':id/finalizar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  finalizarTorneo(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.finalizarTorneo(id, req.user.id);
  }

  @Put(':id/cancelar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  cancelarTorneo(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Request() req,
  ) {
    return this.tournamentsService.cancelarTorneo(id, req.user.id, body.motivo);
  }

  @Post(':id/flyer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFlyer(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo de imagen requerido');
    }

    const tournament = await this.tournamentsService.findOne(id);
    if (tournament.organizadorId !== req.user.id) {
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('admin')) {
        throw new BadRequestException('No tienes permiso para modificar este torneo');
      }
    }

    const result = await this.cloudinaryService.uploadImage(file, {
      folder: 'fairpadel/flyers',
      transformation: [CloudinaryService.PRESETS.TOURNAMENT_FLYER],
    });

    await this.tournamentsService.updateFlyerUrl(id, result.url);

    return { flyerUrl: result.url, message: 'Flyer subido exitosamente' };
  }

  @Patch(':id/categorias/:tournamentCategoryId/toggle-inscripcion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  toggleInscripcionCategoria(
    @Param('id') id: string,
    @Param('tournamentCategoryId') tournamentCategoryId: string,
    @Request() req,
  ) {
    return this.tournamentsService.toggleInscripcionCategoria(id, tournamentCategoryId, req.user.id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getStats(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getStats(id, req.user.id);
  }

  @Get(':id/financiero')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  getDashboardFinanciero(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getDashboardFinanciero(id, req.user.id);
  }

  @Get(':id/inscripciones/excel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  async exportInscripcionesExcel(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.tournamentsService.exportInscripcionesExcel(id, req.user.id);
    const tournament = await this.tournamentsService.findOne(id);
    const filename = `inscripciones-${tournament.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/pelotas-ronda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getPelotasRonda(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getPelotasRonda(id, req.user.id);
  }

  @Put(':id/pelotas-ronda')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  updatePelotasRonda(
    @Param('id') id: string,
    @Body() data: { rondas: { ronda: string; cantidadPelotas: number }[] },
    @Request() req,
  ) {
    return this.tournamentsService.updatePelotasRonda(id, data.rondas, req.user.id);
  }

  // ═══════════════════════════════════════════
  // AYUDANTES
  // ═══════════════════════════════════════════

  @Get(':id/ayudantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  getAyudantes(@Param('id') id: string, @Request() req) {
    return this.tournamentsService.getAyudantes(id, req.user.id);
  }

  @Post(':id/ayudantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  addAyudante(
    @Param('id') id: string,
    @Body() data: { documento: string; nombre?: string; rol?: string },
    @Request() req,
  ) {
    return this.tournamentsService.addAyudante(id, data, req.user.id);
  }

  @Delete(':id/ayudantes/:ayudanteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador')
  removeAyudante(
    @Param('id') id: string,
    @Param('ayudanteId') ayudanteId: string,
    @Request() req,
  ) {
    return this.tournamentsService.removeAyudante(id, ayudanteId, req.user.id);
  }

  // ═══════════════════════════════════════════
  // CUENTAS BANCARIAS
  // ═══════════════════════════════════════════

  @Get(':id/cuentas-bancarias')
  getCuentasBancarias(@Param('id') id: string) {
    return this.tournamentsService.getCuentasBancarias(id);
  }

  @Post(':id/cuentas-bancarias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  createCuentaBancaria(
    @Param('id') id: string,
    @Body() data: {
      banco: string;
      titular: string;
      cedulaRuc: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
    },
    @Request() req,
  ) {
    return this.tournamentsService.createCuentaBancaria(id, data, req.user.id);
  }

  @Put(':id/cuentas-bancarias/:cuentaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  updateCuentaBancaria(
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Body() data: {
      banco?: string;
      titular?: string;
      cedulaRuc?: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
      activa?: boolean;
    },
    @Request() req,
  ) {
    return this.tournamentsService.updateCuentaBancaria(id, cuentaId, data, req.user.id);
  }

  @Delete(':id/cuentas-bancarias/:cuentaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizador', 'admin')
  deleteCuentaBancaria(
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Request() req,
  ) {
    return this.tournamentsService.deleteCuentaBancaria(id, cuentaId, req.user.id);
  }
}