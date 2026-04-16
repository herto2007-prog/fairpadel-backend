import { IsString, IsOptional, IsBoolean, IsInt, IsEmail, Min } from 'class-validator';

export class CreateAlquilerConfigDto {
  @IsString()
  sedeId: string;

  @IsString()
  @IsOptional()
  encargadoId?: string;

  @IsBoolean()
  @IsOptional()
  habilitado?: boolean;

  @IsInt()
  @IsOptional()
  @Min(1)
  duracionSlotMinutos?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  anticipacionMaxDias?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  cancelacionMinHoras?: number;

  @IsString()
  @IsOptional()
  mensajeBienvenida?: string;

  @IsString()
  @IsOptional()
  telefonoNotificaciones?: string;

  @IsEmail()
  @IsOptional()
  emailNotificaciones?: string;
}
