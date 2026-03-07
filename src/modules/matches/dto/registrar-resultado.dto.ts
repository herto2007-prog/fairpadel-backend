import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class RegistrarResultadoDto {
  @IsInt()
  @Min(0)
  @Max(7)
  set1Pareja1: number;

  @IsInt()
  @Min(0)
  @Max(7)
  set1Pareja2: number;

  @IsInt()
  @Min(0)
  @Max(7)
  set2Pareja1: number;

  @IsInt()
  @Min(0)
  @Max(7)
  set2Pareja2: number;

  @IsInt()
  @Min(0)
  @Max(7)
  @IsOptional()
  set3Pareja1?: number;

  @IsInt()
  @Min(0)
  @Max(7)
  @IsOptional()
  set3Pareja2?: number;

  @IsString()
  @IsOptional()
  notas?: string;
}
