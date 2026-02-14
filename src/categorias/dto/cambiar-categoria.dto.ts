import { IsUUID, IsString, IsEnum } from 'class-validator';

export class CambiarCategoriaDto {
  @IsUUID()
  nuevaCategoriaId: string;

  @IsEnum(['ASCENSO_MANUAL', 'DESCENSO_MANUAL'])
  tipo: 'ASCENSO_MANUAL' | 'DESCENSO_MANUAL';

  @IsString()
  motivo: string;
}
