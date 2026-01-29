import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  documento: string;

  @IsString()
  @MinLength(8)
  password: string;
}