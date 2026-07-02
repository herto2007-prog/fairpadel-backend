import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

export class CrearMiRankingDto {
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 letras' })
  @MaxLength(60, { message: 'El nombre no puede superar las 60 letras' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ciudad?: string;
}

export class EditarMiRankingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'FINALIZADO'])
  estado?: string;
}

export class SumarTorneoDto {
  @IsString()
  torneoId: string;
}
