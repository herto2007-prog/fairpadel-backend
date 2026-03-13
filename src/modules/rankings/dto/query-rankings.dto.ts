import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Gender } from '@prisma/client';

export class QueryRankingsDto {
  @IsOptional()
  @IsString({ message: 'Categoría inválida' })
  categoriaId?: string;

  @IsOptional()
  @IsString({ message: 'Ciudad inválida' })
  ciudad?: string;

  @IsOptional()
  @IsString({ message: 'Temporada inválida' })
  temporada?: string; // "2025", "2026", etc.

  @IsOptional()
  @IsString({ message: 'Circuito inválido' })
  circuitoId?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Género inválido' })
  genero?: Gender;
}
