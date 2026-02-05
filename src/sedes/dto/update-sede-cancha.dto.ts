import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
  IsUrl,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { TipoCancha } from '@prisma/client';

export class UpdateSedeCanchaDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoCancha)
  tipo?: TipoCancha;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  posicionX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1500)
  posicionY?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  ancho?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(400)
  alto?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  rotacion?: number;

  @IsOptional()
  @IsUrl()
  imagenUrl?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
