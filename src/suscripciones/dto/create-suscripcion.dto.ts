import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSuscripcionDto {
  @IsNotEmpty()
  @IsString()
  planId: string;

  @IsOptional()
  @IsString()
  cuponCodigo?: string;
}
