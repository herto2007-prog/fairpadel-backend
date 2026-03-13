import { IsString, IsOptional, IsDateString, Length } from 'class-validator';

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

  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  facebook?: string;
}

export class UpdatePasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @Length(6, 100)
  passwordNuevo: string;
}
