import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../modules/auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Sube una imagen de perfil de usuario
   * POST /api/uploads/avatar
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ninguna imagen');
    }

    const result = await this.uploadsService.uploadImage(file, 'avatars');

    return {
      success: true,
      message: 'Avatar subido exitosamente',
      data: {
        url: result.url,
        publicId: result.publicId,
      },
    };
  }

  /**
   * Sube una imagen genérica (para posts, torneos, etc.)
   * POST /api/uploads/image
   */
  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string = 'general',
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ninguna imagen');
    }

    // Validar que folder solo contenga caracteres permitidos
    const validFolder = /^[a-zA-Z0-9_-]+$/.test(folder) ? folder : 'general';

    const result = await this.uploadsService.uploadImage(file, validFolder);

    return {
      success: true,
      message: 'Imagen subida exitosamente',
      data: {
        url: result.url,
        publicId: result.publicId,
      },
    };
  }

  /**
   * Sube múltiples imágenes (para galerías)
   * POST /api/uploads/gallery
   * Nota: Este endpoint requiere configuración adicional para múltiples archivos
   */
  @Post('gallery')
  @UseGuards(JwtAuthGuard)
  async uploadGallery() {
    return {
      success: false,
      message: 'Funcionalidad en desarrollo',
    };
  }
}
