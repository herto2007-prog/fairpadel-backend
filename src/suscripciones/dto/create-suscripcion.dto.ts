import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateSuscripcionDto {
  @IsNotEmpty()
  @IsString()
  planId: string;

  @IsNotEmpty()
  @IsEnum(['MENSUAL', 'ANUAL'])
  periodo: 'MENSUAL' | 'ANUAL';

  @IsOptional()
  @IsString()
  cuponCodigo?: string;
}