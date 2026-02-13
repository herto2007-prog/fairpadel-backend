import {
  IsString,
  IsOptional,
  IsDateString,
  IsUrl,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateCircuitoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsString()
  pais: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  temporada: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
