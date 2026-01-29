import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export class CreateInscripcionDto {
  @IsNotEmpty()
  @IsString()
  tournamentId: string;

  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @IsNotEmpty()
  @IsEnum(['TRADICIONAL', 'MIXTO', 'SUMA'])
  modalidad: 'TRADICIONAL' | 'MIXTO' | 'SUMA';

  @IsNotEmpty()
  @IsString()
  jugador2Documento: string;

  @IsNotEmpty()
  @IsEnum(['BANCARD', 'TRANSFERENCIA', 'EFECTIVO'])
  metodoPago: 'BANCARD' | 'TRANSFERENCIA' | 'EFECTIVO';
}