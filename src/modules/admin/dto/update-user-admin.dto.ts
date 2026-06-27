import { IsString, IsOptional, IsEnum, IsEmail, IsBoolean, Matches } from 'class-validator';
import { Gender, UserStatus } from '@prisma/client';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  categoriaActualId?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  fechaNacimiento?: string;

  @IsOptional()
  @IsEnum(Gender)
  genero?: Gender;

  @IsOptional()
  @IsEnum(UserStatus)
  estado?: UserStatus;

  @IsOptional()
  @IsString()
  motivoCambioCategoria?: string;

  // Organizador de confianza: publica torneos sin pasar por aprobación.
  @IsOptional()
  @IsBoolean()
  autoPublica?: boolean;
}
