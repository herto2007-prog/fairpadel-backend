import { IsString, IsOptional, IsNumber, Matches } from 'class-validator';

export class CreateAmericanoTorneoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  ciudad: string;

  @IsString()
  @IsOptional()
  visibilidad?: string; // 'publico' | 'privado'

  @IsNumber()
  @IsOptional()
  limiteInscripciones?: number;
}
