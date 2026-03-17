import { IsString, IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';

export enum TipoEntrada {
  INSCRIPCION = 'INSCRIPCION',
  GANADOR_ZONA = 'GANADOR_ZONA',
  PERDEDOR_ZONA = 'PERDEDOR_ZONA',
  GANADOR_REPECHAJE = 'GANADOR_REPECHAJE',
  BYE_DIRECTO = 'BYE_DIRECTO',
}

export enum FaseBracket {
  ZONA = 'ZONA',
  REPECHAJE = 'REPECHAJE',
  TREINTAYDOSAVOS = 'TREINTAYDOSAVOS',
  DIECISEISAVOS = 'DIECISEISAVOS',
  OCTAVOS = 'OCTAVOS',
  CUARTOS = 'CUARTOS',
  SEMIS = 'SEMIS',
  FINAL = 'FINAL',
}

export class GenerateBracketDto {
  @IsString()
  tournamentCategoryId: string;

  @IsNumber()
  @Min(3)
  @Max(64)
  totalParejas: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  parejasConBye?: number = 0;

  @IsOptional()
  @IsString({ each: true })
  inscripcionIds?: string[]; // Orden de sorteo
}

export class BracketConfigResponse {
  totalParejas: number;
  tamanoBracket: number; // 8, 16, 32
  parejasConBye: number;
  partidosZona: number;
  parejasEnRepechaje: number;
  partidosRepechaje: number;
  ganadoresZona: number;
  ganadoresRepechaje: number;
  perdedoresDirectos: number;
  fases: FaseBracket[];
}

export class MatchNode {
  id: string;
  fase: FaseBracket;
  orden: number;
  esBye: boolean;
  tipoEntrada1?: TipoEntrada;
  tipoEntrada2?: TipoEntrada;
  inscripcion1Id?: string;
  inscripcion2Id?: string;
  partidoOrigen1Id?: string;
  partidoOrigen2Id?: string;
  partidoSiguienteId?: string;
  partidoPerdedorSiguienteId?: string;
  posicionEnSiguiente?: number;
  posicionEnPerdedor?: number;
}
