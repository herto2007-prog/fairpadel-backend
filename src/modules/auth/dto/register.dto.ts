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

  // Datos opcionales en el registro: se piden "just-in-time" al inscribirse
  // a un torneo. El registro mínimo solo exige email, contraseña, nombre y
  // apellido. Los validadores de formato siguen aplicando SI el valor se envía.
  @IsString({ message: 'El documento debe ser texto' })
  @Matches(/^[0-9]+$/, { message: 'El documento debe contener solo números' })
  @IsOptional()
  documento?: string;

  @IsString({ message: 'El teléfono debe ser texto' })
  @IsOptional()
  telefono?: string;

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  @IsOptional()
  fechaNacimiento?: string;

  @IsEnum(Gender, { message: 'El género debe ser MASCULINO o FEMENINO' })
  @IsOptional()
  genero?: Gender;

  @IsString({ message: 'La ciudad debe ser texto' })
  @IsOptional()
  ciudad?: string;

  @IsString({ message: 'La categoría debe ser texto' })
  @IsOptional()
  categoria?: string;

  @IsString({ message: 'La URL de foto debe ser texto' })
  @IsOptional()
  fotoUrl?: string;

  @IsBoolean({ message: 'El consentimiento de WhatsApp debe ser booleano' })
  @IsOptional()
  consentCheckboxWhatsapp?: boolean;
}
