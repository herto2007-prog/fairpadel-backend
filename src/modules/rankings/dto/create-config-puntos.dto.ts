import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateConfigPuntosDto {
  @IsString({ message: 'La posición es requerida' })
  posicion: string; // "1ro", "2do", "3ro-4to", etc.

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  descripcion?: string;

  @IsInt({ message: 'Los puntos deben ser un número entero' })
  @Min(0, { message: 'Los puntos no pueden ser negativos' })
  puntosBase: number;

  @IsInt({ message: 'El orden debe ser un número entero' })
  orden: number;
}

export class UpdateConfigPuntosDto {
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  descripcion?: string;

  @IsOptional()
  @IsInt({ message: 'Los puntos deben ser un número entero' })
  @Min(0, { message: 'Los puntos no pueden ser negativos' })
  puntosBase?: number;

  @IsOptional()
  @IsBoolean({ message: 'Activo debe ser booleano' })
  activo?: boolean;
}
