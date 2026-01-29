import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional, Matches } from 'class-validator';

export enum Gender {
  FEMENINO = 'FEMENINO',
  MASCULINO = 'MASCULINO',
}

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  documento: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nombre: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  apellido: string;

  @IsEnum(Gender)
  genero: Gender;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Teléfono debe tener formato internacional válido' })
  telefono: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Contraseña debe tener al menos 1 mayúscula, 1 minúscula y 1 número',
  })
  password: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  fotoUrl?: string;
}