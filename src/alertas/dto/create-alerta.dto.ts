import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { TipoAlertaPersonalizada } from '@prisma/client';

export class CreateAlertaDto {
  @IsEnum(TipoAlertaPersonalizada)
  tipo: TipoAlertaPersonalizada;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  config?: any;
}
