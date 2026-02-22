import { IsOptional, IsString, Matches } from 'class-validator';

export class SortearCategoriaDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio?: string;
}
