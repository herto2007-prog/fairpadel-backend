import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsOptional } from 'class-validator';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../modules/auth/decorators/get-user.decorator';
import { User } from '@prisma/client';

// DTO para upload de imágenes
class UploadImageDto {
  @IsString()
  @IsOptional()
  folder?: string;
}

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
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Permitir campos extra de Multer
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImageDto,
  ) {
    console.log('[Upload] Recibiendo petición de upload');
    console.log('[Upload] DTO recibido:', dto);
    console.log('[Upload] File presente:', !!file);
    
    if (!file) {
      console.log('[Upload] Error: No file recibido');
      throw new BadRequestException('No se proporcionó ninguna imagen');
    }

    console.log('[Upload] File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferPresente: !!file.buffer,
    });

    const folder = dto.folder || 'general';
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

  /**
   * Health check del servicio de uploads
   * GET /api/uploads/health
   */
  @Get('health')
  healthCheck() {
    return {
      success: true,
      message: 'Servicio de uploads activo',
      timestamp: new Date().toISOString(),
    };
  }
}
