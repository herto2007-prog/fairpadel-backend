import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

// NUEVO: DTO para asignación directa por admin (sin solicitud)
export class AsignarTorneoDirectoDto {
  @IsString({ message: 'El circuito es requerido' })
  circuitoId: string;

  @IsString({ message: 'El torneo es requerido' })
  torneoId: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean({ message: 'Puntos válidos debe ser booleano' })
  puntosValidos?: boolean;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}

// DEPRECATED: Flujo de solicitud por organizador (se mantiene por compatibilidad)
export class SolicitarInclusionDto {
  @IsString({ message: 'El circuito es requerido' })
  circuitoId: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}

export class ProcesarSolicitudDto {
  @IsString({ message: 'El estado es requerido' })
  estado: 'APROBADO' | 'RECHAZADO';

  @IsOptional()
  @IsBoolean({ message: 'Puntos válidos debe ser booleano' })
  puntosValidos?: boolean;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}

export class ConfigurarTorneoCircuitoDto {
  @IsOptional()
  @IsBoolean({ message: 'Puntos válidos debe ser booleano' })
  puntosValidos?: boolean;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsBoolean({ message: 'Es final debe ser booleano' })
  esFinal?: boolean;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  notas?: string;
}
