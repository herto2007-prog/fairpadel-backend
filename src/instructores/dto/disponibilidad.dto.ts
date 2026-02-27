import { IsInt, Min, Max, IsString, Matches, IsBoolean, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class DisponibilidadSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number; // 0=dom..6=sab

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaInicio: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaFin: string;
}

export class ActualizarDisponibilidadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisponibilidadSlotDto)
  slots: DisponibilidadSlotDto[];
}

export class CrearBloqueoDto {
  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
