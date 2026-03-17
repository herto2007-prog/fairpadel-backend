import { IsString, IsOptional, IsDateString, IsInt, IsEnum, IsBoolean, Matches } from 'class-validator';
import { MetodoPagoAlquiler } from '@prisma/client';

export class CreateReservaDto {
  @IsString()
  sedeCanchaId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  horaInicio: string;

  @IsString()
  horaFin: string;

  @IsInt()
  @IsOptional()
  duracionMinutos?: number;

  @IsInt()
  precio: number;

  @IsString()
  @IsOptional()
  nombreExterno?: string;

  @IsString()
  @IsOptional()
  telefonoExterno?: string;

  @IsString()
  @IsOptional()
  notas?: string;
}

export class ConfirmarReservaDto {
  @IsEnum(MetodoPagoAlquiler)
  metodoPago: MetodoPagoAlquiler;

  @IsBoolean()
  @IsOptional()
  compromisoPago?: boolean;
}

export class CancelarReservaDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}
