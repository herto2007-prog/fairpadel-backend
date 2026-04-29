import { IsString, IsOptional } from 'class-validator';

export class InscribirJugadorAmericanoDto {
  @IsString()
  jugadorId: string;

  @IsString()
  @IsOptional()
  telefonoEmergencia?: string;
}
