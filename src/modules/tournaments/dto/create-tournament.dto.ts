import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsDecimal,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { TournamentStatus } from '@prisma/client';

export class CreateTournamentDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @IsOptional()
  descripcion?: string;

  @IsDateString({}, { message: 'La fecha de inicio no es válida' })
  fechaInicio: string;

  @IsDateString({}, { message: 'La fecha de fin no es válida' })
  fechaFin: string;

  @IsDateString({}, { message: 'La fecha límite de inscripción no es válida' })
  fechaLimiteInscr: string;

  @IsString({ message: 'La ciudad debe ser texto' })
  @IsNotEmpty({ message: 'La ciudad es requerida' })
  ciudad: string;

  @IsString({ message: 'El país debe ser texto' })
  @IsOptional()
  pais?: string;

  @IsDecimal({}, { message: 'El costo de inscripción debe ser un número' })
  @IsOptional()
  costoInscripcion?: string;

  @IsInt({ message: 'Los minutos por partido deben ser un número entero' })
  @Min(30, { message: 'Mínimo 30 minutos por partido' })
  @IsOptional()
  minutosPorPartido?: number;

  @IsString({ message: 'Las categorías deben ser un array de IDs' })
  @IsOptional()
  categoryIds?: string[];
}
