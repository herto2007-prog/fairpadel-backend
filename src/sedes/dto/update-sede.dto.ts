import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateSedeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  direccion?: string;

  @IsOptional()
  @IsUrl()
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  imagenFondo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  horarioAtencion?: string;

  @IsOptional()
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

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
