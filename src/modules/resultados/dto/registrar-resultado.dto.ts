import { IsInt, IsOptional, IsEnum, IsString, Min, Max, ValidateIf } from 'class-validator';
import { FormatoSet3, MatchStatus } from '@prisma/client';

export class RegistrarResultadoDto {
  @IsInt({ message: 'Set 1 pareja 1 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(7, { message: 'El set no puede tener más de 7 games' })
  set1Pareja1: number;

  @IsInt({ message: 'Set 1 pareja 2 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(7, { message: 'El set no puede tener más de 7 games' })
  set1Pareja2: number;

  @IsInt({ message: 'Set 2 pareja 1 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(7, { message: 'El set no puede tener más de 7 games' })
  set2Pareja1: number;

  @IsInt({ message: 'Set 2 pareja 2 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(7, { message: 'El set no puede tener más de 7 games' })
  set2Pareja2: number;

  @IsOptional()
  @IsInt({ message: 'Set 3 pareja 1 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(20, { message: 'El set 3 no puede tener más de 20 games/puntos' })
  set3Pareja1?: number;

  @IsOptional()
  @IsInt({ message: 'Set 3 pareja 2 debe ser un número' })
  @Min(0, { message: 'El set no puede ser negativo' })
  @Max(20, { message: 'El set 3 no puede tener más de 20 games/puntos' })
  set3Pareja2?: number;

  @IsEnum(FormatoSet3, { message: 'Formato del set 3 inválido' })
  formatoSet3: FormatoSet3;

  @IsOptional()
  @IsString({ message: 'Observaciones debe ser texto' })
  observaciones?: string;

  @IsOptional()
  @IsInt({ message: 'Duración debe ser en minutos' })
  @Min(1, { message: 'Duración mínima 1 minuto' })
  duracionMinutos?: number;
}

export class RegistrarPuntoDto {
  @IsEnum(['PUNTO', 'FALTA_DIRECTA', 'ACE', 'DOBLE_FALTA'], { message: 'Tipo de punto inválido' })
  tipo: 'PUNTO' | 'FALTA_DIRECTA' | 'ACE' | 'DOBLE_FALTA';

  @IsInt({ message: 'El ganador debe ser 1 o 2' })
  @Min(1)
  @Max(2)
  ganador: number; // 1 o 2 - qué pareja ganó el punto

  @IsOptional()
  @IsString({ message: 'Detalle debe ser texto' })
  detalle?: string;
}

export class IniciarPartidoDto {
  @IsOptional()
  @IsEnum(FormatoSet3, { message: 'Formato del set 3 inválido' })
  formatoSet3?: FormatoSet3;
}

export class FinalizarPartidoDto {
  @IsOptional()
  @IsString({ message: 'Observaciones debe ser texto' })
  observaciones?: string;

  @IsOptional()
  @IsInt({ message: 'Duración debe ser en minutos' })
  @Min(1)
  duracionMinutos?: number;
}
