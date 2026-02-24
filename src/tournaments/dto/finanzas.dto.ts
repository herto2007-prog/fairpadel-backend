import { IsString, IsEnum, IsNumber, IsOptional, IsDateString, MaxLength, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export enum TipoMovimientoDto {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export enum CategoriaMovimientoDto {
  PREMIO = 'PREMIO',
  ARBITRAJE = 'ARBITRAJE',
  ALQUILER_CANCHA = 'ALQUILER_CANCHA',
  PELOTAS = 'PELOTAS',
  PUBLICIDAD = 'PUBLICIDAD',
  LOGISTICA = 'LOGISTICA',
  ALIMENTACION = 'ALIMENTACION',
  AUSPICIO_EFECTIVO = 'AUSPICIO_EFECTIVO',
  OTRO = 'OTRO',
}

export class CreateMovimientoDto {
  @IsEnum(TipoMovimientoDto)
  tipo: TipoMovimientoDto;

  @IsEnum(CategoriaMovimientoDto)
  categoria: CategoriaMovimientoDto;

  @IsString()
  @MaxLength(300)
  concepto: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  monto: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateMovimientoDto extends PartialType(CreateMovimientoDto) {}

export class CreateAuspicianteEspecieDto {
  @IsOptional()
  @IsUUID()
  sponsorId?: string;

  @IsString()
  nombre: string;

  @IsString()
  descripcion: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  valorEstimado: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateAuspicianteEspecieDto extends PartialType(CreateAuspicianteEspecieDto) {}
