import { IsInt, Min, Max, IsBoolean, IsString, IsOptional } from 'class-validator';

export class CargarResultadoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  set1Pareja1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  set1Pareja2?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  set2Pareja1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  set2Pareja2?: number;

  // Set 3 permite hasta 99 para super tie-break (a 10 con diferencia de 2)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  set3Pareja1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  set3Pareja2?: number;

  @IsBoolean()
  esWalkOver: boolean;

  @IsOptional()
  @IsBoolean()
  esRetiro?: boolean;

  @IsOptional()
  @IsString()
  parejaGanadoraId?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
