import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min, Max, ArrayMinSize } from 'class-validator';

/**
 * DTO para configurar horarios de semifinales y finales (Paso 1.a)
 * Las semifinales se juegan antes que las finales
 */
export class ConfigurarFinalesDto {
  @IsString()
  tournamentId: string;

  // Horario de semifinales (primera mitad del día de finales)
  @IsString()
  horaInicioSemifinales: string; // "14:00"

  @IsString()
  horaFinSemifinales: string; // "16:00"

  @IsArray()
  @IsString({ each: true })
  canchasSemifinalesIds: string[];

  // Horario de finales (segunda mitad del día de finales)
  @IsString()
  horaInicioFinales: string; // "16:00"

  @IsString()
  horaFinFinales: string; // "18:00"

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
