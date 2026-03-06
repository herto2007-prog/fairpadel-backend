import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'El documento debe ser texto' })
  @IsNotEmpty({ message: 'El documento es requerido' })
  @Matches(/^[0-9]+$/, { message: 'El documento debe contener solo números' })
  documento: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;
}
