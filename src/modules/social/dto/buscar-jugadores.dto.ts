import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BuscarJugadoresDto {
  @IsOptional()
  @IsString()
  q?: string; // Búsqueda por nombre/apellido

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
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
}
