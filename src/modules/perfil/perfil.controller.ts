import { Controller, Get, Put, Param, UseGuards, Request, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PerfilService } from './perfil.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { UpdatePerfilDto, UpdatePasswordDto } from './dto/update-perfil.dto';
import { UploadsService } from '../../uploads/uploads.service';

@Controller('users')
export class PerfilController {
  constructor(
    private readonly perfilService: PerfilService,
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * GET /users/profile/me
   * Obtiene el perfil completo del usuario autenticado
   * Requiere autenticación
   * 
   * NOTA: Esta ruta debe ir PRIMERO, antes de profile/:id
   * para evitar que "me" sea interpretado como un ID
   */
  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  async getMiPerfil(@Request() req: any) {
    return this.perfilService.getMiPerfil(req.user.userId);
  }

  /**
   * GET /users/profile/:id
   * Obtiene el perfil público de cualquier jugador
   * No requiere autenticación
   */
  @Get('profile/:id')
  @Public()
  async getPerfilJugador(@Param('id') userId: string) {
    return this.perfilService.getPerfilJugador(userId);
  }

  /**
   * PUT /users/profile
   * Actualiza los datos del perfil del usuario autenticado
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updatePerfil(@Request() req: any, @Body() dto: UpdatePerfilDto) {
    return this.perfilService.updatePerfil(req.user.userId, dto);
  }

  /**
   * PUT /users/profile/foto
   * Actualiza la foto de perfil
   */
  @Put('profile/foto')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async updateFoto(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { success: false, message: 'No se proporcionó ninguna imagen' };
    }

    const result = await this.uploadsService.uploadImage(file, 'avatars');
    return this.perfilService.updateFoto(req.user.userId, result.url);
  }

  /**
   * PUT /users/profile/banner
   * Actualiza el banner del perfil
   */
  @Put('profile/banner')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async updateBanner(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { success: false, message: 'No se proporcionó ninguna imagen' };
    }

    const result = await this.uploadsService.uploadImage(file, 'banners');
    return this.perfilService.updateBanner(req.user.userId, result.url);
  }

  /**
   * PUT /users/profile/password
   * Cambia la contraseña del usuario
   */
  @Put('profile/password')
  @UseGuards(JwtAuthGuard)
  async updatePassword(@Request() req: any, @Body() dto: UpdatePasswordDto) {
    return this.perfilService.updatePassword(
      req.user.userId,
      dto.passwordActual,
      dto.passwordNuevo,
    );
  }
}
