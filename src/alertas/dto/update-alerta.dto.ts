import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateAlertaDto {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  config?: any;
}
