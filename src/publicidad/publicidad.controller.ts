import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PublicidadService } from './publicidad.service';
import { CreateBannerDto, UpdateBannerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('publicidad')
export class PublicidadController {
  constructor(private readonly publicidadService: PublicidadService) {}

  // ═══════════════════════════════════════════════════════
  // ADMIN: CRUD BANNERS
  // ═══════════════════════════════════════════════════════

  @Post('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  crearBanner(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBannerDto,
  ) {
    return this.publicidadService.crearBanner(dto, file);
  }

  @Put('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  actualizarBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.publicidadService.actualizarBanner(id, dto, file);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  eliminarBanner(@Param('id') id: string) {
    return this.publicidadService.eliminarBanner(id);
  }

  @Get('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listarBanners() {
    return this.publicidadService.listarBanners();
  }

  @Get('banners/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  obtenerEstadisticas() {
    return this.publicidadService.obtenerEstadisticas();
  }

  @Put('banners/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  toggleActivo(@Param('id') id: string) {
    return this.publicidadService.toggleActivo(id);
  }

  // ═══════════════════════════════════════════════════════
  // PÚBLICO: BANNERS ACTIVOS POR ZONA
  // ═══════════════════════════════════════════════════════

  @Get('activos/:zona')
  obtenerBannersActivos(@Param('zona') zona: string) {
    return this.publicidadService.obtenerBannersActivos(zona);
  }

  @Post('click/:id')
  registrarClick(@Param('id') id: string) {
    return this.publicidadService.registrarClick(id);
  }

  @Post('impresion')
  registrarImpresion(@Body() body: { ids: string[] }) {
    return this.publicidadService.registrarImpresion(body.ids);
  }
}
