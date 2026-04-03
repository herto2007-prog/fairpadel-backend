import { IsString, IsOptional, IsInt, IsBoolean, IsDateString, Min, Max } from 'class-validator';

export class CreateCircuitoDto {
  @IsString({ message: 'El nombre es requerido' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  descripcion?: string;

  @IsString({ message: 'La ciudad es requerida' })
  ciudad: string;

  @IsOptional()
  @IsString({ message: 'La región debe ser texto' })
  region?: string;

  @IsOptional()
  @IsString({ message: 'La temporada debe ser texto' })
  temporada?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de inicio inválida' })
  fechaInicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de fin inválida' })
  fechaFin?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha límite de inscripción inválida' })
  fechaLimiteInscripcion?: string;

  @IsOptional()
  @IsString({ message: 'El color primario debe ser texto' })
  colorPrimario?: string;

  @IsOptional()
  @IsInt({ message: 'El número de torneos para clasificar debe ser un número' })
  @Min(1)
  torneosParaClasificar?: number;

  @IsOptional()
  @IsInt({ message: 'Los puntos mínimos deben ser un número' })
  @Min(0)
  puntosMinimosClasificar?: number;

  @IsOptional()
  @IsBoolean({ message: 'Tiene final debe ser booleano' })
  tieneFinal?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Destacado debe ser booleano' })
  destacado?: boolean;
}

export class UpdateCircuitoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  descripcion?: string;

  @IsOptional()
  @IsString({ message: 'El estado debe ser texto' })
  estado?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de fin inválida' })
  fechaFin?: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsBoolean({ message: 'Destacado debe ser booleano' })
  destacado?: boolean;
}
