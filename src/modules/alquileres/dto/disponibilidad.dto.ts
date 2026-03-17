import { IsString, IsDateString, IsOptional, Matches } from 'class-validator';

export class ConsultarDisponibilidadDto {
  @IsString()
  sedeId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @IsOptional()
  sedeCanchaId?: string;
}

export class CrearAlquilerPrecioDto {
  @IsString()
  sedeId: string;

  @IsString()
  tipoCancha: string;

  @IsString()
  tipoDia: string;

  @IsString()
  franja: string;

  @IsString()
  precio: number;
}
