import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  url: string;
  thumbnailUrl: string;
  publicId: string;
}

export interface CloudinaryUploadOptions {
  folder: string;
  transformation?: Record<string, any>[];
  publicId?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  // Presets de transformación reutilizables
  static readonly PRESETS = {
    PROFILE: {
      width: 400,
      height: 400,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto',
      fetch_format: 'auto',
    },
    PROFILE_THUMB: {
      width: 100,
      height: 100,
      crop: 'thumb',
      gravity: 'face',
      quality: 'auto',
      fetch_format: 'auto',
    },
    GALLERY: {
      width: 1600,
      quality: 'auto:good',
      fetch_format: 'auto',
    },
    GALLERY_THUMB: {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
    },
    BANNER: {
      width: 1920,
      height: 400,
      crop: 'fill',
      quality: 'auto:best',
      fetch_format: 'auto',
    },
    BANNER_SLIM: {
      width: 1920,
      height: 180,
      crop: 'fill',
      quality: 'auto:best',
      fetch_format: 'auto',
    },
    BANNER_MEDIUM: {
      width: 1920,
      height: 300,
      crop: 'fill',
      quality: 'auto:best',
      fetch_format: 'auto',
    },
    BANNER_TORNEO: {
      width: 1920,
      height: 200,
      crop: 'fill',
      quality: 'auto:best',
      fetch_format: 'auto',
    },
    SPONSOR: {
      width: 300,
      height: 150,
      crop: 'fit',
      quality: 'auto',
      fetch_format: 'auto',
    },
    TOURNAMENT_FLYER: {
      width: 1200,
      quality: 'auto:best',
      fetch_format: 'auto',
    },
  };

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret && apiKey !== 'dev-mode') {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log('Cloudinary configurado correctamente');
    } else {
      this.isConfigured = false;
      this.logger.warn('Cloudinary no configurado — modo desarrollo (URLs simuladas)');
    }
  }

  /**
   * Sube una imagen a Cloudinary desde un buffer (Express.Multer.File).
   * Retorna URL optimizada, thumbnail y publicId para eliminación futura.
   */
  async uploadImage(
    file: Express.Multer.File,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured) {
      return this.mockUpload(options.folder);
    }

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: 'image',
        transformation: options.transformation,
        overwrite: true,
      });

      // Generar URL optimizada
      const url = cloudinary.url(result.public_id, {
        secure: true,
        transformation: options.transformation || [CloudinaryService.PRESETS.GALLERY],
      });

      // Generar thumbnail
      const thumbnailUrl = cloudinary.url(result.public_id, {
        secure: true,
        transformation: [CloudinaryService.PRESETS.GALLERY_THUMB],
      });

      this.logger.log(`Imagen subida: ${result.public_id} (${result.bytes} bytes)`);

      return {
        url: result.secure_url,
        thumbnailUrl,
        publicId: result.public_id,
      };
    } catch (error) {
      this.logger.error(`Error subiendo imagen: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sube una foto de perfil con crop facial automático.
   */
  async uploadProfilePhoto(file: Express.Multer.File, userId: string): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured) {
      return this.mockUpload('fairpadel/profiles');
    }

    try {
      const result = await this.uploadStream(file.buffer, {
        folder: 'fairpadel/profiles',
        public_id: `user_${userId}`,
        resource_type: 'image',
        overwrite: true,
        transformation: [CloudinaryService.PRESETS.PROFILE],
      });

      const thumbnailUrl = cloudinary.url(result.public_id, {
        secure: true,
        transformation: [CloudinaryService.PRESETS.PROFILE_THUMB],
      });

      this.logger.log(`Foto de perfil subida: ${result.public_id}`);

      return {
        url: result.secure_url,
        thumbnailUrl,
        publicId: result.public_id,
      };
    } catch (error) {
      this.logger.error(`Error subiendo foto de perfil: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sube un banner publicitario.
   */
  async uploadBanner(file: Express.Multer.File, bannerId?: string): Promise<CloudinaryUploadResult> {
    return this.uploadImage(file, {
      folder: 'fairpadel/banners',
      publicId: bannerId ? `banner_${bannerId}` : undefined,
      transformation: [CloudinaryService.PRESETS.BANNER],
    });
  }

  /**
   * Sube un logo de sponsor.
   */
  async uploadSponsorLogo(file: Express.Multer.File): Promise<CloudinaryUploadResult> {
    return this.uploadImage(file, {
      folder: 'fairpadel/sponsors',
      transformation: [CloudinaryService.PRESETS.SPONSOR],
    });
  }

  /**
   * Elimina una imagen de Cloudinary por su publicId.
   */
  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.log(`[DEV] Eliminando imagen simulada: ${publicId}`);
      return;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Imagen eliminada: ${publicId} (${result.result})`);
    } catch (error) {
      this.logger.error(`Error eliminando imagen ${publicId}: ${error.message}`);
    }
  }

  /**
   * Genera una URL optimizada con transformaciones.
   */
  getOptimizedUrl(
    publicId: string,
    options: { width?: number; height?: number; crop?: string; quality?: string },
  ): string {
    if (!this.isConfigured) {
      return `https://res.cloudinary.com/demo/image/upload/${publicId}`;
    }

    return cloudinary.url(publicId, {
      secure: true,
      transformation: [{
        width: options.width,
        height: options.height,
        crop: options.crop || 'fill',
        quality: options.quality || 'auto',
        fetch_format: 'auto',
      }],
    });
  }

  // ═══════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════

  /**
   * Sube un buffer a Cloudinary usando streams (eficiente en memoria).
   */
  private uploadStream(
    buffer: Buffer,
    options: Record<string, any>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  /**
   * Mock para modo desarrollo (sin credenciales Cloudinary).
   */
  private mockUpload(folder: string): CloudinaryUploadResult {
    const timestamp = Date.now();
    const id = `${folder}/mock_${timestamp}`;
    this.logger.log(`[DEV] Upload simulado: ${id}`);
    return {
      url: `https://res.cloudinary.com/demo/image/upload/v${timestamp}/${id}.jpg`,
      thumbnailUrl: `https://res.cloudinary.com/demo/image/upload/c_thumb,w_200,h_200/v${timestamp}/${id}.jpg`,
      publicId: id,
    };
  }
}
