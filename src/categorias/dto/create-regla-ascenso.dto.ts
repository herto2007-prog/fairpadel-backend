import { IsUUID, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateReglaAscensoDto {
  @IsUUID()
  categoriaOrigenId: string;

  @IsUUID()
  categoriaDestinoId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  campeonatosConsecutivos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  campeonatosAlternados?: number;

  @IsOptional()
  @IsBoolean()
  finalistaCalifica?: boolean;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
