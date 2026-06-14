import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoAlertaPersonalizada } from '@prisma/client';

export class CreateAlertaDto {
  @IsEnum(TipoAlertaPersonalizada)
  tipo: TipoAlertaPersonalizada;

  // Requerida para TORNEO_EN_MI_CIUDAD: la ciudad a vigilar.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ciudad?: string;
}
