import {
  IsArray,
  IsBoolean,
  IsString,
  IsUUID,
  ValidateNested,
  IsDateString,
  IsOptional,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HorarioDto {
  @IsDateString()
  fecha: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaInicio debe tener formato HH:MM',
  })
  horaInicio: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaFin debe tener formato HH:MM',
  })
  horaFin: string;
}

export class CanchaConfigDto {
  @IsUUID()
  sedeCanchaId: string;

  @IsBoolean()
  @IsOptional()
  esPrincipal?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  @IsOptional()
  horarios: HorarioDto[];
}

export class ConfigurarTorneoCanchasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanchaConfigDto)
  canchas: CanchaConfigDto[];
}
