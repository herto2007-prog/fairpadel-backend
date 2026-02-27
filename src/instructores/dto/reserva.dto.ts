import { IsString, IsOptional, IsDateString, Matches, IsEnum, IsInt, Min } from 'class-validator';

export enum TipoClaseEnum {
  INDIVIDUAL = 'INDIVIDUAL',
  GRUPAL = 'GRUPAL',
}

export class CrearReservaDto {
  @IsEnum(TipoClaseEnum)
  tipo: TipoClaseEnum;

  @IsDateString()
  fecha: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaInicio: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  duracionMinutos?: number; // default 60

  @IsOptional()
  @IsString()
  mensaje?: string;
}

export class RechazarReservaDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
