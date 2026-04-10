import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * DTO para buscar jugadores con filtros
 * Siguiendo regla #4: Strings vacíos se transforman a undefined
 */
export class BuscarJugadoresDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  q?: string; // Búsqueda por nombre/apellido

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  ciudad?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  categoriaId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  // Cache buster (ignorado por el servicio, pero permitido por el pipe)
  @IsOptional()
  @IsString()
  _t?: string;
}
