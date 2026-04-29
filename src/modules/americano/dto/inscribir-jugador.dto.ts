import { IsString, IsOptional } from 'class-validator';

export class InscribirJugadorAmericanoDto {
  @IsString()
  jugadorId: string;

  @IsString()
  @IsOptional()
  jugador2Id?: string;

  @IsString()
  @IsOptional()
  telefonoEmergencia?: string;
}
