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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetResultDto)
  sets: SetResultDto[];

  @IsNumber()
  @IsOptional()
  puntosBonusA?: number;

  @IsNumber()
  @IsOptional()
  puntosBonusB?: number;
}
