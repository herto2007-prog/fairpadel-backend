import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  // Acepta email O documento (cédula). Se mantiene el nombre del campo
  // `documento` por compatibilidad con el frontend actual, pero el valor
  // puede ser un email. La resolución se hace en auth.service.login.
  @IsString({ message: 'El identificador debe ser texto' })
  @IsNotEmpty({ message: 'Ingresá tu email o documento' })
  documento: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;
}
