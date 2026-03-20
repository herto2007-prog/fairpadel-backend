import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min, Max, ArrayMinSize } from 'class-validator';

/**
 * DTO para configurar horarios de finales (Paso 1.a)
 */
export class ConfigurarFinalesDto {
  @IsString()
  tournamentId: string;

  @IsString()
  horaInicio: string; // "18:00"

  @IsString()
  horaFin: string; // "23:00"

  @IsArray()
  @IsString({ each: true })
  canchasFinalesIds: string[];
}

/**
 * DTO para configurar días de juego (Paso 1.b)
 */
export class ConfigurarDiaJuegoDto {
  @IsString()
  tournamentId: string;

  @IsString()
  fecha: string; // "2026-03-20"

  @IsString()
  horaInicio: string; // "18:00"

  @IsString()
  horaFin: string; // "23:00"

  @IsNumber()
  @Min(30)
  @Max(180)
  minutosSlot: number = 90;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  canchasIds: string[]; // IDs de TorneoCancha
}

/**
 * DTO para cerrar inscripciones y sortear (Paso 2)
 */
export class CerrarInscripcionesSortearDto {
  @IsString()
  tournamentId: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categoriasIds: string[]; // TournamentCategory IDs a cerrar/sortear
}

/**
 * Respuesta con el cálculo de slots necesarios
 */
export interface CalculoSlotsResponse {
  totalSlotsNecesarios: number;
  slotsDisponibles: number;
  slotsFaltantes: number;
  horasNecesarias: number;
  horasDisponibles: number;
  duracionPromedioMinutos: number;
  detallePorCategoria: {
    categoriaId: string;
    nombre: string;
    parejas: number;
    slotsNecesarios: number;
    partidosPorFase: { fase: string; partidos: number }[];
  }[];
  valido: boolean;
  mensaje?: string;
}

/**
 * Respuesta del sorteo masivo
 */
export interface SorteoMasivoResponse {
  success: boolean;
  message: string;
  categoriasSorteadas: {
    categoriaId: string;
    nombre: string;
    fixtureVersionId: string;
    totalPartidos: number;
    slotsReservados: number;
  }[];
  slotsTotalesReservados: number;
  distribucionPorDia: {
    fecha: string;
    slotsReservados: number;
    categorias: string[];
  }[];
}
