import { IsString, IsOptional, Matches } from 'class-validator';

export class ConsultarDisponibilidadDto {
  @IsString()
  sedeId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @IsOptional()
  sedeCanchaId?: string;
}
