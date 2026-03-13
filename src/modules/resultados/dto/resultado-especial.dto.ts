import { IsInt, IsOptional, IsString, IsEnum, Min, Max } from 'class-validator';

export enum TipoResultadoEspecial {
  RETIRO_LESION = 'RETIRO_LESION',
  RETIRO_OTRO = 'RETIRO_OTRO',
  DESCALIFICACION = 'DESCALIFICACION',
  WO = 'WO',
}

export class ResultadoEspecialDto {
  @IsEnum(TipoResultadoEspecial, { message: 'Tipo de resultado especial inválido' })
  tipo: TipoResultadoEspecial;

  @IsInt({ message: 'La pareja afectada debe ser 1 o 2' })
  @Min(1, { message: 'La pareja debe ser 1 o 2' })
  @Max(2, { message: 'La pareja debe ser 1 o 2' })
  parejaAfectada: number; // 1 o 2 - qué pareja se retiró/fue descalificada

  @IsOptional()
  @IsString({ message: 'La razón debe ser texto' })
  razon?: string; // Ej: "Lesión en rodilla", "Conducta antideportiva", etc.

  @IsOptional()
  @IsInt({ message: 'Duración debe ser en minutos' })
  @Min(1, { message: 'Duración mínima 1 minuto' })
  duracionMinutos?: number;

  @IsOptional()
  @IsString({ message: 'Observaciones debe ser texto' })
  observaciones?: string;
}
