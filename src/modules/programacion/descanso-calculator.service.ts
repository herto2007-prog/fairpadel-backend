import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { horaAMinutos, minutosAHora, formatearMinutos } from '../../common/utils/time-helpers';

// Configurar dayjs con plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const TZ_PARAGUAY = 'America/Asuncion';

export interface DescansoConfig {
  /** Descanso entre fases ZONA (minutos) */
  descansoEntreZonas: number;
  /** Descanso de ZONA a SEMIS (minutos) - default: 240 (4 horas) */
  descansoZonaASemis: number;
  /** Descanso de SEMIS a FINAL (minutos) - default: 240 (4 horas) */
  descansoSemisAFinal: number;
}

export interface HoraMinimaResultado {
  fecha: string; // "2024-03-18"
  hora: string;  // "02:30"
}

export interface SlotInfo {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface ValidacionDescansoResultado {
  valido: boolean;
  tiempoDescansoMinutos: number;
  tiempoRequeridoMinutos: number;
  razon?: string;
}

/**
 * TABLA COMPLETA DE DESCANSOS ENTRE FASES
 * Todas las transiciones de fase deben estar aquí.
 * Default: 240 minutos (4 horas)
 */
const DESCANSOS_ENTRE_FASES: Record<string, number> = {
  // Misma fase: sin descanso
  'ZONA-ZONA': 0,
  'REPECHAJE-REPECHAJE': 0,
  'OCTAVOS-OCTAVOS': 0,
  'CUARTOS-CUARTOS': 0,
  'SEMIS-SEMIS': 0,
  'FINAL-FINAL': 0,
  
  // Transiciones ZONA → X: 4 horas
  'ZONA-REPECHAJE': 240,
  'ZONA-OCTAVOS': 240,
  'ZONA-CUARTOS': 240,
  'ZONA-SEMIS': 240,
  'ZONA-FINAL': 240,
  
  // Transiciones REPECHAJE → X: 4 horas
  'REPECHAJE-OCTAVOS': 240,
  'REPECHAJE-CUARTOS': 240,
  'REPECHAJE-SEMIS': 240,
  'REPECHAJE-FINAL': 240,
  
  // Transiciones OCTAVOS → X: 4 horas
  'OCTAVOS-CUARTOS': 240,
  'OCTAVOS-SEMIS': 240,
  'OCTAVOS-FINAL': 240,
  
  // Transiciones CUARTOS → X: 4 horas
  'CUARTOS-SEMIS': 240,
  'CUARTOS-FINAL': 240,
  
  // Transiciones SEMIS → X: 4 horas
  'SEMIS-FINAL': 240,
};

/**
 * Servicio dedicado al cálculo de descansos entre partidos/fases.
 * 
 * ALGORITMO PRINCIPAL:
 * Hora último partido + descanso = Hora mínima para siguiente
 * 
 * Ejemplo: 22:30 + 4h = 02:30 (día siguiente)
 *          Buscar primer slot disponible >= 02:30
 */
@Injectable()
export class DescansoCalculatorService {
  
  private readonly defaultConfig: DescansoConfig = {
    descansoEntreZonas: 0,
    descansoZonaASemis: 240, // 4 horas
    descansoSemisAFinal: 240, // 4 horas
  };

  /**
   * Calcula la hora mínima de inicio para el siguiente partido
   * considerando el descanso requerido.
   * 
   * @param ultimoPartidoFecha - Fecha del último partido ("2024-03-17")
   * @param ultimoPartidoHoraFin - Hora fin del último partido ("22:30")
   * @param descansoMinutos - Minutos de descanso requeridos (default: 240 = 4h)
   * @returns Objeto con fecha y hora mínima permitida
   * 
   * Ejemplos:
   * - calcularHoraMinimaDescanso("2024-03-17", "22:30", 240) 
   *   → { fecha: "2024-03-18", hora: "02:30" }
   * 
   * - calcularHoraMinimaDescanso("2024-03-17", "14:00", 240)
   *   → { fecha: "2024-03-17", hora: "18:00" }
   */
  calcularHoraMinimaDescanso(
    ultimoPartidoFecha: string,
    ultimoPartidoHoraFin: string,
    descansoMinutos: number = 240
  ): HoraMinimaResultado {
    // Usar dayjs con zona horaria explícita de Paraguay
    const fechaHora = dayjs.tz(
      `${ultimoPartidoFecha}T${ultimoPartidoHoraFin}`,
      TZ_PARAGUAY
    );
    
    const resultado = fechaHora.add(descansoMinutos, 'minute');
    
    return {
      fecha: resultado.format('YYYY-MM-DD'),
      hora: resultado.format('HH:mm'),
    };
  }

  /**
   * Obtiene los minutos de descanso requeridos según la transición de fases.
   * 
   * @param faseOrigen - Fase del partido anterior ("ZONA", "SEMIS", etc.)
   * @param faseDestino - Fase del siguiente partido ("ZONA", "SEMIS", "FINAL")
   * @param config - Configuración personalizada (opcional)
   * @returns Minutos de descanso requeridos
   */
  getDescansoEntreFases(
    faseOrigen: string,
    faseDestino: string,
    config?: Partial<DescansoConfig>
  ): number {
    const cfg = { ...this.defaultConfig, ...config };
    
    // Si hay config personalizada, usarla
    if (config) {
      if (faseOrigen === faseDestino) {
        return cfg.descansoEntreZonas;
      }
      if (faseOrigen === 'ZONA' && faseDestino === 'SEMIS') {
        return cfg.descansoZonaASemis;
      }
      if (faseOrigen === 'SEMIS' && faseDestino === 'FINAL') {
        return cfg.descansoSemisAFinal;
      }
    }
    
    const key = `${faseOrigen}-${faseDestino}`;
    
    // Buscar en tabla completa
    if (key in DESCANSOS_ENTRE_FASES) {
      return DESCANSOS_ENTRE_FASES[key];
    }
    
    // Fallback: misma fase = 0, diferente fase = 240
    if (faseOrigen === faseDestino) {
      return 0;
    }
    
    return 240; // Default 4 horas
  }

  /**
   * Verifica si un slot específico cumple con las reglas de descanso.
   * Usa comparación numérica de minutos (NO strings).
   * 
   * @param slot - Información del slot a validar
   * @param ultimoPartido - Información del último partido jugado
   * @param descansoMinutos - Minutos de descanso requeridos
   * @returns Resultado de la validación
   */
  validarSlotConDescanso(
    slot: SlotInfo,
    ultimoPartido: SlotInfo,
    descansoMinutos: number = 240
  ): ValidacionDescansoResultado {
    // Calcular hora mínima permitida usando dayjs
    const horaMinima = this.calcularHoraMinimaDescanso(
      ultimoPartido.fecha,
      ultimoPartido.horaFin,
      descansoMinutos
    );

    // Comparar usando minutos (NO strings)
    const slotMinutos = horaAMinutos(slot.horaInicio);
    const minimaMinutos = horaAMinutos(horaMinima.hora);
    
    // Si es diferente día, siempre es válido (asume día siguiente tiene slots disponibles)
    const mismoDia = slot.fecha === ultimoPartido.fecha;
    const slotEsPosterior = slot.fecha > horaMinima.fecha || 
                           (slot.fecha === horaMinima.fecha && slotMinutos >= minimaMinutos);

    // Calcular tiempo de descanso real en minutos
    const ultimoDateTime = dayjs.tz(
      `${ultimoPartido.fecha}T${ultimoPartido.horaFin}`,
      TZ_PARAGUAY
    );
    const slotDateTime = dayjs.tz(
      `${slot.fecha}T${slot.horaInicio}`,
      TZ_PARAGUAY
    );
    const tiempoDescansoMinutos = slotDateTime.diff(ultimoDateTime, 'minute');

    // Validar
    const valido = slotEsPosterior && tiempoDescansoMinutos >= descansoMinutos;

    return {
      valido,
      tiempoDescansoMinutos,
      tiempoRequeridoMinutos: descansoMinutos,
      razon: valido ? undefined : 
        `Slot empieza a ${slot.horaInicio}, pero se requiere descanso hasta ${horaMinima.hora} (${formatearMinutos(descansoMinutos)})`,
    };
  }

  /**
   * Encuentra el primer slot válido de una lista ordenada.
   * 
   * @param slots - Lista de slots disponibles (debe estar ordenada por fecha/hora)
   * @param ultimoPartido - Información del último partido
   * @param descansoMinutos - Minutos de descanso requeridos
   * @returns El primer slot válido o null si ninguno cumple
   */
  encontrarPrimerSlotValido(
    slots: SlotInfo[],
    ultimoPartido: SlotInfo,
    descansoMinutos: number = 240
  ): SlotInfo | null {
    for (const slot of slots) {
      const validacion = this.validarSlotConDescanso(slot, ultimoPartido, descansoMinutos);
      if (validacion.valido) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Filtra todos los slots válidos que cumplen con el descanso requerido.
   * 
   * @param slots - Lista de slots disponibles
   * @param ultimoPartido - Información del último partido
   * @param descansoMinutos - Minutos de descanso requeridos
   * @returns Lista de slots válidos
   */
  filtrarSlotsValidos(
    slots: SlotInfo[],
    ultimoPartido: SlotInfo,
    descansoMinutos: number = 240
  ): SlotInfo[] {
    return slots.filter(slot => {
      const validacion = this.validarSlotConDescanso(slot, ultimoPartido, descansoMinutos);
      return validacion.valido;
    });
  }

  /**
   * Formatea minutos en formato legible (ej: "4h 30m" o "240 minutos").
   * 
   * @param minutos - Cantidad de minutos
   * @returns String formateado
   */
  formatearTiempo(minutos: number): string {
    if (minutos < 60) {
      return `${minutos} minutos`;
    }
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (mins === 0) {
      return `${horas} horas`;
    }
    return `${horas}h ${mins}m`;
  }
}
