import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UbicacionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  sedeId?: string;

  @IsOptional()
  @IsString()
  nombreCustom?: string;

  @IsString({ message: 'La ciudad es requerida' })
  ciudad: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}

export class ActualizarInstructorDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  experienciaAnios?: number;

  @IsOptional()
  @IsString()
  certificaciones?: string;

  @IsOptional()
  @IsString()
  especialidades?: string;

  @IsOptional()
  @IsString()
  nivelesEnsenanza?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioIndividual?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioGrupal?: number;

  @IsOptional()
  @IsBoolean()
  aceptaDomicilio?: boolean;
}

export class ActualizarUbicacionesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UbicacionDto)
  ubicaciones: UbicacionDto[];
}
