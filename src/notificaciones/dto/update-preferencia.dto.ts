import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenciaDto {
  @IsString()
  tipoNotificacion: string;

  @IsOptional()
  @IsBoolean()
  recibirEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  recibirSms?: boolean;
}
