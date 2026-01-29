import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MensajeDto {
  @IsNotEmpty()
  @IsString()
  destinatarioId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  contenido: string;
}