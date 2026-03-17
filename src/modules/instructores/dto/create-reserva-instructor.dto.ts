import { IsString, IsOptional, IsDateString, IsInt, IsEnum, Matches } from 'class-validator';
import { TipoClase } from '@prisma/client';

export class CreateReservaInstructorDto {
  @IsString()
  instructorId: string;

  @IsEnum(TipoClase)
  tipo: TipoClase;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  horaInicio: string;

  @IsString()
  horaFin: string;

  @IsInt()
  @IsOptional()
  duracionMinutos?: number;

  @IsInt()
  precio: number;

  @IsString()
  @IsOptional()
  mensaje?: string;
}

export class ConfirmarReservaInstructorDto {
  @IsString()
  @IsOptional()
  respuesta?: string;
}

export class CancelarReservaInstructorDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}
