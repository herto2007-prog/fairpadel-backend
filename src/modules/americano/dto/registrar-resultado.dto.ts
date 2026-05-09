import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SetResultDto {
  @IsNumber()
  gamesEquipoA: number;

  @IsNumber()
  gamesEquipoB: number;
}

export class RegistrarResultadoDto {
  @IsString()
  partidoId: string; // ID del slot/match en el bracket

  @IsString()
  parejaAId: string;

  @IsString()
  parejaBId: string;

  // Para formatos tradicionales (games, mejorDe3Sets, tiempo)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetResultDto)
  sets?: SetResultDto[];

  // Para formato puntosFijos
  @IsNumber()
  @IsOptional()
  puntosA?: number;

  @IsNumber()
  @IsOptional()
  puntosB?: number;

  @IsNumber()
  @IsOptional()
  puntosBonusA?: number;

  @IsNumber()
  @IsOptional()
  puntosBonusB?: number;
}
