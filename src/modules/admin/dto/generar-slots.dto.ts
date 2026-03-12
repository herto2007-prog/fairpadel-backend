/**
 * DTO para generar slots de disponibilidad
 * 
 * Body opcional: { canchaIds?: string[] }
 * - Si no se envía: genera slots para TODAS las canchas activas
 * - Si se envía array vacío: no genera slots (0 resultados)
 * - Si se envía array con IDs: genera solo para esas canchas específicas
 */
export class GenerarSlotsDto {
  canchaIds?: string[];
}
