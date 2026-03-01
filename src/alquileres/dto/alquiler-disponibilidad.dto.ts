import {
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DisponibilidadSlotDto {
  @IsUUID()
  sedeCanchaId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaFin: string;
}

export class ConfigurarDisponibilidadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisponibilidadSlotDto)
  slots: DisponibilidadSlotDto[];
}
