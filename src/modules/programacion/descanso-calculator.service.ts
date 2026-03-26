import { Injectable } from '@nestjs/common';

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
   * TU ALGORITMO: Hora último partido + descanso = hora mínima
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
    // Crear fecha completa del último partido
    const fechaHora = new Date(`${ultimoPartidoFecha}T${ultimoPartidoHoraFin}`);
    
    // Sumar minutos de descanso
    fechaHora.setMinutes(fechaHora.getMinutes() + descansoMinutos);
    
    // Extraer fecha y hora del resultado
    const fecha = fechaHora.toISOString().split('T')[0];
    const hora = fechaHora.toTimeString().slice(0, 5);
    
    return { fecha, hora };
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
    
    // Si es la misma fase, usar descanso entre zonas
    if (faseOrigen === faseDestino) {
      return cfg.descansoEntreZonas;
    }
    
    // Transición ZONA → SEMIS
    if (faseOrigen === 'ZONA' && faseDestino === 'SEMIS') {
      return cfg.descansoZonaASemis;
    }
    
    // Transición SEMIS → FINAL
    if (faseOrigen === 'SEMIS' && faseDestino === 'FINAL') {
      return cfg.descansoSemisAFinal;
    }
    
    // Por defecto, usar descanso entre zonas
    return cfg.descansoEntreZonas;
  }

  /**
   * Verifica si un slot específico cumple con las reglas de descanso.
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
    // Calcular hora mínima permitida
    const horaMinima = this.calcularHoraMinimaDescanso(
      ultimoPartido.fecha,
      ultimoPartido.horaFin,
      descansoMinutos
    );

    // Crear objetos Date para comparación
    const slotDateTime = new Date(`${slot.fecha}T${slot.horaInicio}`);
    const minimaDateTime = new Date(`${horaMinima.fecha}T${horaMinima.hora}`);

    // Calcular tiempo de descanso real en minutos
    const tiempoDescansoMs = slotDateTime.getTime() - new Date(`${ultimoPartido.fecha}T${ultimoPartido.horaFin}`).getTime();
    const tiempoDescansoMinutos = Math.floor(tiempoDescansoMs / (1000 * 60));

    // Validar
    const valido = slotDateTime >= minimaDateTime;

    return {
      valido,
      tiempoDescansoMinutos,
      tiempoRequeridoMinutos: descansoMinutos,
      razon: valido ? undefined : 
        `Slot empieza a ${slot.horaInicio}, pero se requiere descanso hasta ${horaMinima.hora} (${descansoMinutos} min)`,
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
