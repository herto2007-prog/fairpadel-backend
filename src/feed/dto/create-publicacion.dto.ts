import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePublicacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contenido?: string;

  @IsOptional()
  @IsString()
  fotoId?: string;
}
