import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateTournamentDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsOptional()
  nombre?: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @IsOptional()
  descripcion?: string;

  @IsDateString({}, { message: 'La fecha de inicio no es válida' })
  @IsOptional()
  fechaInicio?: string;

  @IsDateString({}, { message: 'La fecha de fin no es válida' })
  @IsOptional()
  fechaFin?: string;

  @IsDateString({}, { message: 'La fecha de inicio de inscripción no es válida' })
  @IsOptional()
  fechaInicioInscripcion?: string;

  @IsDateString({}, { message: 'La fecha de fin de inscripción no es válida' })
  @IsOptional()
  fechaFinInscripcion?: string;

  @IsInt({ message: 'El máximo de parejas debe ser un número entero' })
  @Min(1, { message: 'Mínimo 1 pareja' })
  @IsOptional()
  maxParejas?: number;

  @IsInt({ message: 'El mínimo de parejas debe ser un número entero' })
  @Min(1, { message: 'Mínimo 1 pareja' })
  @IsOptional()
  minParejas?: number;

  @IsInt({ message: 'Los puntos de ranking deben ser un número entero' })
  @IsOptional()
  puntosRanking?: number;

  @IsString({ message: 'El premio debe ser texto' })
  @IsOptional()
  premio?: string;

  @IsString({ message: 'La URL del flyer debe ser texto' })
  @IsOptional()
  flyerUrl?: string;

  @IsString({ message: 'Las categorías deben ser un array de IDs' })
  @IsOptional()
  categoryIds?: string[];
}
