import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min, Max, ArrayMinSize, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

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

  /**
   * Fecha del día de juego en formato YYYY-MM-DD.
   * Si se envía con hora (ISO), se extrae automáticamente la fecha.
   * @example "2026-03-27"
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD (ej: 2026-03-27)',
  })
  @Transform(({ value }) => {
    // Si viene como ISO string (2026-03-27T00:00:00Z), extraer solo YYYY-MM-DD
    if (typeof value === 'string' && value.length > 10) {
      return value.substring(0, 10);
    }
    return value;
  })
  fecha: string;

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

  // NUEVO: Fases que pueden jugarse en este día (opcional, para override manual)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fasesPermitidas?: string[]; // ['ZONA', 'REPECHAJE'] - Si no se envía, se calcula automáticamente
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

  /**
   * Fecha desde la cual se pueden asignar slots (formato YYYY-MM-DD).
   * Útil para sortear por lotes: el segundo lote no usa días del pasado.
   * @example "2026-06-19" - Solo asigna slots desde el 19 en adelante
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD (ej: 2026-06-19)',
  })
  fechaDesde?: string;
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
  categoriasIgnoradas?: {
    categoriaId: string;
    nombre?: string;
    fixtureVersionId: string | null;
  }[];
  slotsTotalesReservados: number;
  distribucionPorDia: {
    fecha: string;
    slotsReservados: number;
    categorias: string[];
  }[];
}
