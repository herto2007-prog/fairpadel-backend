import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SolicitarInstructorDto {
  @IsInt({ message: 'Los años de experiencia deben ser un número entero' })
  @Min(0, { message: 'Los años de experiencia no pueden ser negativos' })
  experienciaAnios: number;

  @IsOptional()
  @IsString()
  certificaciones?: string;

  @IsOptional()
  @IsString()
  especialidades?: string;

  @IsOptional()
  @IsString()
  nivelesEnsenanza?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsInt({ message: 'El precio individual debe ser un número entero' })
  @Min(0, { message: 'El precio individual no puede ser negativo' })
  precioIndividual?: number;

  @IsOptional()
  @IsInt({ message: 'El precio grupal debe ser un número entero' })
  @Min(0, { message: 'El precio grupal no puede ser negativo' })
  precioGrupal?: number;

  @IsOptional()
  @IsString()
  ciudades?: string;
}
