import { IsArray, IsOptional, IsString, ArrayNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO para generar slots de disponibilidad
 * Permite especificar canchas específicas, o generar para todas si no se especifica
 */
export class GenerarSlotsDto {
  @IsOptional()
  @IsArray({ message: 'canchaIds debe ser un array' })
  @ArrayNotEmpty({ message: 'canchaIds no puede estar vacío si se proporciona' })
  @IsString({ each: true, message: 'Cada ID de cancha debe ser un string' })
  @IsUUID('4', { each: true, message: 'Cada ID de cancha debe ser un UUID válido' })
  canchaIds?: string[];
}
