import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUrl,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Convierte strings vacios a undefined
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));

export class CreateSedeDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la sede es obligatorio' })
  @MaxLength(200)
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(100)
  ciudad: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(300)
  direccion?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsUrl()
  mapsUrl?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsUrl()
  imagenFondo?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(200)
  horarioAtencion?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(200)
  contactoEncargado?: string;

  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(2000)
  canvasWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(1500)
  canvasHeight?: number;
}