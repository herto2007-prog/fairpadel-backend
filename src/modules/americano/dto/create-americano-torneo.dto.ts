import { IsString, IsOptional, IsNumber, IsArray, Matches, IsEnum, IsBoolean } from 'class-validator';

export class CreateAmericanoTorneoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaLimiteInscripcion debe tener formato YYYY-MM-DD' })
  fechaLimiteInscripcion?: string;

  @IsString()
  ciudad: string;

  @IsString()
  @IsOptional()
  pais?: string;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsNumber()
  @IsOptional()
  numRondas?: number;

  @IsNumber()
  @IsOptional()
  puntosPorVictoria?: number;

  @IsNumber()
  @IsOptional()
  puntosPorDerrota?: number;

  @IsNumber()
  @IsOptional()
  gamesPorSet?: number;

  @IsBoolean()
  @IsOptional()
  esPublico?: boolean;

  @IsString()
  @IsOptional()
  flyerUrl?: string;
}
