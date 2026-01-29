import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class UploadFotoDto {
  @IsNotEmpty()
  @IsString()
  urlImagen: string; // Base64 o URL

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  tournamentId?: string;

  @IsOptional()
  @IsArray()
  etiquetados?: string[]; // IDs de jugadores etiquetados
}