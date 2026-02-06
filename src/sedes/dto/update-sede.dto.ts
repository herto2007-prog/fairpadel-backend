import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  MaxLength,
  ValidateIf,
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
  @ValidateIf((o) => o.mapsUrl !== '' && o.mapsUrl != null)
  @IsUrl()
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== '' && o.logoUrl != null)
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @ValidateIf((o) => o.imagenFondo !== '' && o.imagenFondo != null)
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
