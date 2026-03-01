import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrearBloqueoAlquilerDto {
  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsUUID()
  sedeCanchaId?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
