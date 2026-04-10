import { IsString, IsUUID, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para seguir/dejar de seguir a un usuario
 */
export class SeguirUsuarioDto {
  @IsUUID()
  @IsNotEmpty()
  usuarioId: string;
}

/**
 * Respuesta de operaciones de seguimiento
 */
export class SeguimientoResponseDto {
  success: boolean;
  message: string;
  data?: {
    siguiendo: boolean;
    seguidoresCount: number;
    siguiendoCount: number;
  };
}

/**
 * DTO para verificar estado de seguimiento
 */
export class CheckSeguimientoDto {
  @IsUUID()
  @IsNotEmpty()
  usuarioId: string;
}

/**
 * DTO para el conteo de seguidores/siguiendo
 */
export class ConteoSeguimientoDto {
  seguidores: number;
  siguiendo: number;
}
