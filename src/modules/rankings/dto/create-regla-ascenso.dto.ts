import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateReglaAscensoDto {
  @IsString({ message: 'Categoría origen es requerida' })
  categoriaOrigenId: string;

  @IsString({ message: 'Categoría destino es requerida' })
  categoriaDestinoId: string;

  @IsInt({ message: 'Campeonatos requeridos debe ser un número' })
  @Min(1, { message: 'Mínimo 1 campeonato' })
  campeonatosRequeridos: number;

  @IsOptional()
  @IsString({ message: 'Tipo de conteo inválido' })
  tipoConteo?: 'CONSECUTIVOS' | 'ALTERNADOS';

  @IsOptional()
  @IsInt({ message: 'Meses ventana debe ser un número' })
  mesesVentana?: number;

  @IsOptional()
  @IsBoolean({ message: 'Finalista califica debe ser booleano' })
  finalistaCalifica?: boolean;

  @IsOptional()
  @IsInt({ message: 'Mínimo torneos jugados debe ser un número' })
  minimoTorneosJugados?: number;
}

export class UpdateReglaAscensoDto {
  @IsOptional()
  @IsInt({ message: 'Campeonatos requeridos debe ser un número' })
  @Min(1, { message: 'Mínimo 1 campeonato' })
  campeonatosRequeridos?: number;

  @IsOptional()
  @IsString({ message: 'Tipo de conteo inválido' })
  tipoConteo?: 'CONSECUTIVOS' | 'ALTERNADOS';

  @IsOptional()
  @IsBoolean({ message: 'Finalista califica debe ser booleano' })
  finalistaCalifica?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Activa debe ser booleano' })
  activa?: boolean;
}
