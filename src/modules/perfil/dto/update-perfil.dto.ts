import { IsString, IsOptional, IsDateString, Length, Matches, IsEnum } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdatePerfilDto {
  @IsString()
  @IsOptional()
  @Length(0, 500)
  bio?: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  pais?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaNacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  facebook?: string;
}

/**
 * Datos de "competidor" que se piden just-in-time al inscribirse a un torneo
 * (no en el registro mínimo). documento/categoria/genero solo se setean si el
 * usuario aún no los tiene; ciudad/telefono/fechaNacimiento se actualizan libremente.
 */
export class CompletarDatosCompetidorDto {
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'El documento debe contener solo números' })
  @IsOptional()
  documento?: string;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsEnum(Gender, { message: 'El género debe ser MASCULINO o FEMENINO' })
  @IsOptional()
  genero?: Gender;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaNacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento?: string;
}

export class UpdatePasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @Length(6, 100)
  passwordNuevo: string;
}

export class UpdatePreferenciasDto {
  @IsString()
  @Matches(/^(EMAIL|WHATSAPP|AMBOS)$/, { message: 'La preferencia debe ser EMAIL, WHATSAPP o AMBOS' })
  preferenciaNotificacion: string;
}
