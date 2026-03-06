import { PartialType } from '@nestjs/mapped-types';
import { CreateInscripcionDto } from './create-inscripcion.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InscripcionEstado } from '@prisma/client';

export class UpdateInscripcionDto extends PartialType(CreateInscripcionDto) {
  @IsEnum(InscripcionEstado)
  @IsOptional()
  estado?: InscripcionEstado;

  @IsString()
  @IsOptional()
  notas?: string;
}

// DTO específico para confirmar/rechazar por organizador
export class ConfirmarInscripcionDto {
  @IsEnum(InscripcionEstado)
  estado: InscripcionEstado;

  @IsString()
  @IsOptional()
  motivo?: string;
}
