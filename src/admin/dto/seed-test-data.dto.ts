import { IsObject, IsNotEmpty } from 'class-validator';

export class SeedTestDataDto {
  @IsObject()
  @IsNotEmpty()
  parejasPorCategoria: Record<string, number>;
}
