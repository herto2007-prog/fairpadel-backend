import { 
  IsString, 
  IsDateString, 
  IsNumber, 
  IsArray, 
  IsOptional, 
  MinLength, 
  MaxLength, 
  Min, 
  IsEnum,
  IsNotEmpty,
  ArrayMinSize
} from 'class-validator';

// ✅ Importamos el enum directamente de Prisma para consistencia
import { Modalidad } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del torneo es obligatorio' })
  @MinLength(5, { message: 'El nombre debe tener al menos 5 caracteres' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres' })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'La descripción no puede exceder 2000 caracteres' })
  descripcion?: string;

  @IsString()
  @IsNotEmpty({ message: 'El país es obligatorio' })
  pais: string;

  @IsString()
  @IsNotEmpty({ message: 'La región es obligatoria' })
  region: string;

  @IsString()
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  ciudad: string;

  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  fechaInicio: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida' })
  fechaFin: string;

  @IsDateString({}, { message: 'La fecha límite de inscripción debe ser una fecha válida' })
  fechaLimiteInscripcion: string;

  @IsString()
  @IsNotEmpty({ message: 'El flyer es obligatorio' })
  flyerUrl: string;

  @IsNumber({}, { message: 'El costo de inscripción debe ser un número' })
  @Min(0, { message: 'El costo de inscripción no puede ser negativo' })
  costoInscripcion: number;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsNumber()
  @IsOptional()
  @Min(15)
  minutosPorPartido?: number;

  @IsString()
  @IsOptional()
  sede?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  mapsUrl?: string;

  @IsArray({ message: 'Las categorías deben ser un array' })
  @ArrayMinSize(1, { message: 'Debes seleccionar al menos una categoría' })
  @IsString({ each: true, message: 'Cada categoría debe ser un ID válido' })
  categorias: string[];

  @IsArray({ message: 'Las modalidades deben ser un array' })
  @ArrayMinSize(1, { message: 'Debes seleccionar al menos una modalidad' })
  @IsEnum(Modalidad, { each: true, message: 'Modalidad inválida' })
  modalidades: Modalidad[];
}

// ✅ Exportamos el enum de Prisma para usar en frontend
export { Modalidad };