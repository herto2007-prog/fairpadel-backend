import { IsString, IsOptional, IsDateString, IsNumber, IsEnum } from 'class-validator';
import { TournamentStatus } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsDateString()
  fechaLimiteInscripcion: string;

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

  @IsEnum(TournamentStatus)
  @IsOptional()
  estado?: TournamentStatus;

  @IsString()
  @IsOptional()
  sedeId?: string;
}
