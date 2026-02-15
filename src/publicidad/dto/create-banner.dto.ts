import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsDateString, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

enum BannerZona {
  HEADER = 'HEADER',
  SIDEBAR = 'SIDEBAR',
  ENTRE_TORNEOS = 'ENTRE_TORNEOS',
  FOOTER = 'FOOTER',
  HOME_HERO = 'HOME_HERO',
  HOME_MEDIO = 'HOME_MEDIO',
  TORNEO_DETALLE = 'TORNEO_DETALLE',
}

export class CreateBannerDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsEnum(BannerZona)
  zona: BannerZona;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  activo?: boolean;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orden?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  anunciante?: string;

  @IsOptional()
  @IsString()
  torneoId?: string;
}
