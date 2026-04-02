import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateBloqueoDto {
  @IsString()
  sedeId: string;

  @IsString()
  @IsOptional()
  sedeCanchaId?: string; // Si es null, aplica a todas las canchas de la sede

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaFin debe tener formato YYYY-MM-DD',
  })
  @IsOptional()
  fechaFin?: string; // Si no se envía, es solo un día

  @IsString()
  @IsOptional()
  motivo?: string;
}

export class UpdateBloqueoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD',
  })
  @IsOptional()
  fechaInicio?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaFin debe tener formato YYYY-MM-DD',
  })
  @IsOptional()
  fechaFin?: string;

  @IsString()
  @IsOptional()
  motivo?: string;
}
