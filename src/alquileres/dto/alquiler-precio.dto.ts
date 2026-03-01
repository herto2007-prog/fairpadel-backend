import {
  IsArray,
  IsEnum,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoCanchaEnum {
  INDOOR = 'INDOOR',
  OUTDOOR = 'OUTDOOR',
  SEMI_TECHADA = 'SEMI_TECHADA',
}

export enum TipoDiaEnum {
  SEMANA = 'SEMANA',
  FIN_DE_SEMANA = 'FIN_DE_SEMANA',
  SABADO = 'SABADO',
  DOMINGO = 'DOMINGO',
}

export enum FranjaHorariaEnum {
  MANANA = 'MANANA',
  TARDE = 'TARDE',
  NOCHE = 'NOCHE',
}

export class PrecioBandaDto {
  @IsEnum(TipoCanchaEnum)
  tipoCancha: TipoCanchaEnum;

  @IsEnum(TipoDiaEnum)
  tipoDia: TipoDiaEnum;

  @IsEnum(FranjaHorariaEnum)
  franja: FranjaHorariaEnum;

  @IsInt()
  @Min(0)
  precio: number;
}

export class ConfigurarPreciosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrecioBandaDto)
  precios: PrecioBandaDto[];
}
