import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadsService {
  private readonly isCloudinaryConfigured: boolean;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.isCloudinaryConfigured = !!(cloudName && apiKey && apiSecret);

    if (this.isCloudinaryConfigured) {
      // Configurar Cloudinary
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      console.log('✅ Cloudinary configurado correctamente');
    } else {
      console.warn('⚠️ Cloudinary NO configurado - las imágenes no se subirán');
      console.warn('   Faltan variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    }
  }

  /**
   * Sube una imagen a Cloudinary
   * @param file - Archivo en formato base64 o buffer
   * @param folder - Carpeta destino en Cloudinary (opcional)
   * @returns URL de la imagen subida
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'fairpadel',
  ): Promise<{ url: string; publicId: string }> {
    // Verificar configuración de Cloudinary
    if (!this.isCloudinaryConfigured) {
      throw new BadRequestException(
        'Servicio de imágenes no configurado. Contacta al administrador.',
      );
    }

    try {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, WEBP)',
        );
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException('El archivo excede el tamaño máximo de 5MB');
      }

      // Convertir buffer a base64
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Subir a Cloudinary
      const result = await cloudinary.uploader.upload(base64Image, {
        folder: `fairpadel/${folder}`,
        transformation: [
          { width: 800, height: 800, crop: 'limit' }, // Limitar tamaño máximo
          { quality: 'auto:good' }, // Optimizar calidad automáticamente
        ],
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir imagen: ${error.message}`,
      );
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   * @param publicId - ID público de la imagen
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException(
        `Error al eliminar imagen: ${error.message}`,
      );
    }
  }

  /**
   * Genera una URL firmada para acceso temporal (si es necesario)
   * @param publicId - ID público de la imagen
   * @param options - Opciones de transformación
   */
  generateSignedUrl(
    publicId: string,
    options: { width?: number; height?: number; crop?: string } = {},
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        ...(options.width ? [{ width: options.width }] : []),
        ...(options.height ? [{ height: options.height }] : []),
        ...(options.crop ? [{ crop: options.crop }] : []),
      ],
    });
  }
}
