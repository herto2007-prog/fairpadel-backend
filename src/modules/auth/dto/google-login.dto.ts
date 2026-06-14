import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  // ID token (JWT) que devuelve el botón "Sign in with Google" del frontend.
  @IsString({ message: 'El token de Google debe ser texto' })
  @IsNotEmpty({ message: 'Falta el token de Google' })
  idToken: string;
}
