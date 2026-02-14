import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsDateString, MaxLength } from 'class-validator';

enum BannerZona {
  HEADER = 'HEADER',
  SIDEBAR = 'SIDEBAR',
  ENTRE_TORNEOS = 'ENTRE_TORNEOS',
  FOOTER = 'FOOTER',
  HOME_HERO = 'HOME_HERO',
  HOME_MEDIO = 'HOME_MEDIO',
  TORNEO_DETALLE = 'TORNEO_DETALLE',
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsEnum(BannerZona)
  zona?: BannerZona;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  anunciante?: string;
}
