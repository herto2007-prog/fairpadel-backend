import { IsString, IsInt, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';

export class CreateDisponibilidadDto {
  @IsString()
  sedeCanchaId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaInicio debe tener formato HH:mm',
  })
  horaInicio: string;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaFin debe tener formato HH:mm',
  })
  horaFin: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean = true;
}

export class UpdateDisponibilidadDto {
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaInicio debe tener formato HH:mm',
  })
  @IsOptional()
  horaInicio?: string;

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaFin debe tener formato HH:mm',
  })
  @IsOptional()
  horaFin?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
