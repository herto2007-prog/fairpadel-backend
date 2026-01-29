import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SolicitudJugarDto {
  @IsNotEmpty()
  @IsString()
  receptorId: string;

  @IsNotEmpty()
  @IsString()
  fechaPropuesta: string;

  @IsNotEmpty()
  @IsString()
  hora: string;

  @IsNotEmpty()
  @IsString()
  lugar: string;

  @IsOptional()
  @IsString()
  mensaje?: string;
}