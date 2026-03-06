import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ModoPagoInscripcion } from '@prisma/client';

export class CreateInscripcionDto {
  @IsUUID()
  tournamentId: string;

  @IsUUID()
  categoryId: string;

  // Jugador 2: se puede buscar por ID (si ya está registrado) o por documento/email (invitar)
  @IsUUID()
  @IsOptional()
  jugador2Id?: string;

  @IsString()
  @IsOptional()
  jugador2Documento?: string;

  @IsString()
  @IsOptional()
  jugador2Email?: string;

  @IsEnum(ModoPagoInscripcion)
  @IsOptional()
  modoPago?: ModoPagoInscripcion;
}
