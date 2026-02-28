import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
  IsUUID,
} from 'class-validator';

export enum MetodoPagoInstructorEnum {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  QR = 'QR',
  OTRO = 'OTRO',
}

export enum ConceptoPagoEnum {
  CLASE = 'CLASE',
  PAQUETE = 'PAQUETE',
  DEUDA = 'DEUDA',
  ADELANTO = 'ADELANTO',
  OTRO = 'OTRO',
}

export class RegistrarPagoDto {
  @IsInt()
  @Min(1)
  monto: number;

  @IsEnum(MetodoPagoInstructorEnum)
  metodoPago: MetodoPagoInstructorEnum;

  @IsEnum(ConceptoPagoEnum)
  @IsOptional()
  concepto?: ConceptoPagoEnum;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsUUID()
  alumnoId?: string;

  @IsOptional()
  @IsString()
  alumnoExternoNombre?: string;

  @IsOptional()
  @IsString()
  alumnoExternoTelefono?: string;

  @IsOptional()
  @IsUUID()
  reservaId?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
