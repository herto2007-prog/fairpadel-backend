import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * DTO para generar slots de disponibilidad
 * Permite especificar canchas específicas, o generar para todas si no se especifica
 * 
 * NOTA: Si canchaIds es undefined o null, genera slots para TODAS las canchas activas
 * Si canchaIds es un array (incluso vacío), solo genera para esas canchas específicas
 */
export class GenerarSlotsDto {
  /**
   * IDs de canchas específicas para generar slots
   * - Opcional: si no se envía, genera para todas las canchas activas del torneo
   * - Array de strings: cada ID debe ser un UUID válido
   * - Array vacío: no genera ningún slot (útil para validación previa)
   */
  @IsOptional()
  @IsArray({ message: 'canchaIds debe ser un array de strings' })
  @IsString({ each: true, message: 'Cada ID de cancha debe ser un string' })
  canchaIds?: string[];
}
