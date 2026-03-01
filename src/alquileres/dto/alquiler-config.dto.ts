import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class HabilitarAlquilerDto {
  @IsUUID()
  sedeId: string;

  @IsOptional()
  @IsUUID()
  encargadoId?: string;

  @IsOptional()
  @IsBoolean()
  requiereAprobacion?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  duracionSlotMinutos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  anticipacionMaxDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  cancelacionMinHoras?: number;

  @IsOptional()
  @IsString()
  mensajeBienvenida?: string;
}

export class ActualizarAlquilerConfigDto {
  @IsOptional()
  @IsUUID()
  encargadoId?: string;

  @IsOptional()
  @IsBoolean()
  requiereAprobacion?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  duracionSlotMinutos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  anticipacionMaxDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  cancelacionMinHoras?: number;

  @IsOptional()
  @IsString()
  mensajeBienvenida?: string;
}
