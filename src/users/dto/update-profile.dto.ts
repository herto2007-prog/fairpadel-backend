import { IsString, IsOptional, MaxLength, IsDateString, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+]?[\d\s\-()]*$/, { message: 'Formato de telefono invalido' })
  telefono?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Formato de fecha invalido (YYYY-MM-DD)' })
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
