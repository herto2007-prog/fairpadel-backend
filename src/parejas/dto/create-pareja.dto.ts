import { IsNotEmpty, IsString } from 'class-validator';

export class CreateParejaDto {
  @IsNotEmpty()
  @IsString()
  jugador2Documento: string;
}