import { IsString, IsOptional, IsArray, IsNumber, IsDateString } from 'class-validator';

export class UpdateTournamentDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  pais?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsDateString()
  @IsOptional()
  fechaLimiteInscripcion?: string;

  @IsString()
  @IsOptional()
  flyerUrl?: string;

  @IsNumber()
  @IsOptional()
  costoInscripcion?: number;

  @IsString()
  @IsOptional()
  sede?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  mapsUrl?: string;

  @IsArray()
  @IsOptional()
  categorias?: string[];

  @IsArray()
  @IsOptional()
  modalidades?: string[];
}