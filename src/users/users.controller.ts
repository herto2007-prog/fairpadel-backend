import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ═══ Rutas fijas ANTES de rutas con :id ═══

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: any) {
    return this.usersService.obtenerPerfilPrivado(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(@Request() req: any, @Body() data: any) {
    return this.usersService.actualizarPerfil(req.user.id, data);
  }

  @Post('foto')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_PHOTO_SIZE },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  async updatePhoto(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar una imagen');
    }
    return this.usersService.actualizarFotoPerfil(req.user.id, file);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') query: string) {
    return this.usersService.buscarPorNombreODocumento(query);
  }

  @Get('documento/:documento')
  @UseGuards(JwtAuthGuard)
  async getByDocumento(@Param('documento') documento: string) {
    const user = await this.usersService.buscarPorDocumento(documento);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      documento: user.documento,
      nombre: user.nombre,
      apellido: user.apellido,
      genero: user.genero,
      ciudad: user.ciudad,
      fotoUrl: user.fotoUrl,
    };
  }

  @Get(':id/perfil-completo')
  @UseGuards(OptionalJwtAuthGuard)
  obtenerPerfilCompleto(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const viewerId = req.user?.id || req.user?.userId || null;
    return this.usersService.obtenerPerfilCompleto(id, viewerId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  obtenerPerfil(@Param('id') id: string) {
    return this.usersService.obtenerPerfilPublico(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    // Verificar que el usuario solo pueda editar su propio perfil
    if (req.user.userId !== id) {
      throw new Error('No puedes editar el perfil de otro usuario');
    }
    return this.usersService.actualizarPerfil(id, data);
  }
}
