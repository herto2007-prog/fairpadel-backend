import { IsString, IsOptional, IsEnum, Matches } from 'class-validator';
import { Gender, UserStatus } from '@prisma/client';

export class UpdateUserAdminDto {
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
}
