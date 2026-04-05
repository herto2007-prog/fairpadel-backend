import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  Matches,
  IsEnum,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'El email no es válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede tener más de 50 caracteres' })
  password: string;

  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre: string;

  @IsString({ message: 'El apellido debe ser texto' })
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  apellido: string;

  @IsString({ message: 'El documento debe ser texto' })
  @IsNotEmpty({ message: 'El documento es requerido' })
  @Matches(/^[0-9]+$/, { message: 'El documento debe contener solo números' })
  documento: string;

  @IsString({ message: 'El teléfono debe ser texto' })
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  @IsNotEmpty({ message: 'La fecha de nacimiento es requerida' })
  fechaNacimiento: string;

  @IsEnum(Gender, { message: 'El género debe ser MASCULINO o FEMENINO' })
  @IsNotEmpty({ message: 'El género es requerido' })
  genero: Gender;

  @IsString({ message: 'La ciudad debe ser texto' })
  @IsNotEmpty({ message: 'La ciudad es requerida' })
  ciudad: string;

  @IsString({ message: 'La categoría debe ser texto' })
  @IsNotEmpty({ message: 'La categoría es requerida' })
  categoria: string;

  @IsString({ message: 'La URL de foto debe ser texto' })
  @IsOptional()
  fotoUrl?: string;

  @IsBoolean({ message: 'El consentimiento de WhatsApp debe ser booleano' })
  @IsOptional()
  consentCheckboxWhatsapp?: boolean;
}
