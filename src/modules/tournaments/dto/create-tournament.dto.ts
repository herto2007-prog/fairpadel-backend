import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, IsArray, Matches } from 'class-validator';
import { TournamentStatus } from '@prisma/client';

export class CreateTournamentDto {
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
  @IsOptional()
  pais?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  ciudad: string;

  @IsString()
  @IsOptional()
  flyerUrl?: string;

  @IsNumber()
  costoInscripcion: number;

  @IsNumber()
  @IsOptional()
  minutosPorPartido?: number;

  @IsEnum(TournamentStatus)
  @IsOptional()
  estado?: TournamentStatus;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFinales debe tener formato YYYY-MM-DD' })
  fechaFinales?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  canchasFinales?: string[];

  @IsString()
  @IsOptional()
  horaInicioFinales?: string;
}
