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
  @IsString({ message: 'Fecha de inicio debe ser texto' })
  fechaInicio?: string;

  @IsOptional()
  @IsString({ message: 'Fecha de fin debe ser texto' })
  fechaFin?: string;

  @IsOptional()
  @IsString({ message: 'Fecha límite debe ser texto' })
  fechaLimiteInscripcion?: string;

  @IsOptional()
  @IsString({ message: 'El color primario debe ser texto' })
  colorPrimario?: string;

  @IsOptional()
  @IsString({ message: 'El logo debe ser una URL válida' })
  logoUrl?: string;

  @IsOptional()
  @IsString({ message: 'El banner debe ser una URL válida' })
  bannerUrl?: string;

  @IsOptional()
  @IsInt({ message: 'El número de torneos para clasificar debe ser un número' })
  @Min(1)
  torneosParaClasificar?: number;

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
  @IsString({ message: 'Fecha de fin debe ser texto' })
  fechaFin?: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsBoolean({ message: 'Destacado debe ser booleano' })
  destacado?: boolean;

  // Configuración de ranking
  @IsOptional()
  @IsString({ message: 'Tipo de acumulación debe ser texto' })
  tipoAcumulacion?: string;

  @IsOptional()
  @IsInt({ message: 'Torneos mínimos debe ser un número' })
  torneosMinimosContar?: number;

  @IsOptional()
  @IsInt({ message: 'Torneos para clasificar debe ser un número' })
  torneosParaClasificar?: number;

  @IsOptional()
  multiplicadorGlobal?: number;

  @IsOptional()
  @IsBoolean({ message: 'Tiene final debe ser booleano' })
  tieneFinal?: boolean;
}
