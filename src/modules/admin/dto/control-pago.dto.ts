import { IsString, IsInt, IsOptional, Min, IsIn, Matches } from 'class-validator';

export class RegistrarPagoOrganizadorDto {
  @IsString()
  inscripcionId: string;

  @IsString()
  jugadorId: string;

  @IsInt()
  @Min(0)
  monto: number;

  @IsString()
  @IsIn(['EFECTIVO', 'TRANSFERENCIA'])
  metodo: 'EFECTIVO' | 'TRANSFERENCIA';

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  fecha: string;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class FiltroControlPagoDto {
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['todos', 'deudores', 'pagados'])
  filtroPago?: string = 'todos';

  @IsOptional()
  @IsString()
  busqueda?: string;
}
