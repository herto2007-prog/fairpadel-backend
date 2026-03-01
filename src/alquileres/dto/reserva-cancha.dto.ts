import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export enum MetodoPagoAlquilerEnum {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  QR = 'QR',
  OTRO = 'OTRO',
}

export class CrearReservaCanchaDto {
  @IsUUID()
  sedeCanchaId: string;

  @IsDateString()
  fecha: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaInicio: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class CrearReservaManualDto {
  @IsUUID()
  sedeCanchaId: string;

  @IsDateString()
  fecha: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  horaInicio: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  nombreExterno?: string;

  @IsOptional()
  @IsString()
  telefonoExterno?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class RechazarReservaCanchaDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class MarcarPagoCanchaDto {
  @IsBoolean()
  pagado: boolean;

  @IsOptional()
  @IsEnum(MetodoPagoAlquilerEnum)
  metodoPago?: MetodoPagoAlquilerEnum;
}
