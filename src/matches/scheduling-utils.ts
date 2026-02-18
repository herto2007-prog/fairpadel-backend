/**
 * Utilidades compartidas para scheduling de partidos
 * Usado por fixture.service.ts y matches.service.ts
 */

export function parseHoraToMinutes(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHora(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
  const totalMinutos = parseHoraToMinutes(horaInicio) + duracionMinutos;
  return minutesToHora(totalMinutos);
}

/**
 * Interfaz para un slot de tiempo discreto en una cancha
 */
export interface TimeSlot {
  torneoCanchaId: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
}

/**
 * Genera slots de tiempo discretos a partir de los rangos de disponibilidad de canchas.
 * Por ej: si una cancha tiene horario 08:00-22:00 y el partido dura 60min + 10min buffer,
 * genera slots: 08:00-09:00, 09:10-10:10, 10:20-11:20, etc.
 */
export function generarTimeSlots(
  torneoCanchas: Array<{
    id: string;
    horarios: Array<{ fecha: Date | string; horaInicio: string; horaFin: string }>;
  }>,
  minutosPorPartido: number,
  bufferMinutos: number = 10,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const slotDuration = minutosPorPartido + bufferMinutos;

  for (const tc of torneoCanchas) {
    for (const horario of tc.horarios || []) {
      const fecha = typeof horario.fecha === 'string' ? new Date(horario.fecha) : horario.fecha;
      const inicioRango = parseHoraToMinutes(horario.horaInicio);
      const finRango = parseHoraToMinutes(horario.horaFin);

      let slotStart = inicioRango;
      while (slotStart + minutosPorPartido <= finRango) {
        slots.push({
          torneoCanchaId: tc.id,
          fecha,
          horaInicio: minutesToHora(slotStart),
          horaFin: minutesToHora(slotStart + minutosPorPartido),
        });
        slotStart += slotDuration;
      }
    }
  }

  // Ordenar por fecha → hora → cancha
  slots.sort((a, b) => {
    const dateA = a.fecha.getTime();
    const dateB = b.fecha.getTime();
    if (dateA !== dateB) return dateA - dateB;

    const horaA = parseHoraToMinutes(a.horaInicio);
    const horaB = parseHoraToMinutes(b.horaInicio);
    if (horaA !== horaB) return horaA - horaB;

    return a.torneoCanchaId.localeCompare(b.torneoCanchaId);
  });

  return slots;
}

/**
 * Genera una key compuesta para identificar un slot único
 * Formato: "canchaId|YYYY-MM-DD|HH:MM"
 */
export function slotKey(canchaId: string, fecha: Date | string, hora: string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const dateStr = d.toISOString().split('T')[0];
  return `${canchaId}|${dateStr}|${hora}`;
}

/**
 * Orden numérico de rondas (menor = primera ronda, mayor = última)
 */
export function getRondaOrden(ronda: string): number {
  const ordenes: Record<string, number> = {
    ACOMODACION_1: 1,
    ACOMODACION_2: 2,
    DIECISEISAVOS: 3,
    RONDA_6: 3,
    RONDA_5: 3,
    OCTAVOS: 4,
    CUARTOS: 5,
    SEMIFINAL: 6,
    FINAL: 7,
  };
  return ordenes[ronda] || 0;
}

// ═══════════════════════════════════════════════════════
// SCHEDULING EQUITATIVO — utilidades de distribución
// ═══════════════════════════════════════════════════════

/**
 * Convierte una fecha a string "YYYY-MM-DD" para usar como key de Map.
 */
export function dateKey(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toISOString().split('T')[0];
}

/**
 * Extrae las fechas únicas de los slots disponibles, ordenadas ASC.
 */
export function extractUniqueDays(slots: TimeSlot[]): Date[] {
  const seen = new Map<string, Date>();
  for (const slot of slots) {
    const dk = dateKey(slot.fecha);
    if (!seen.has(dk)) {
      seen.set(dk, slot.fecha);
    }
  }
  return [...seen.values()].sort((a, b) => a.getTime() - b.getTime());
}

/** Configuración de días para una ronda */
export interface RoundDayConfig {
  preferredDays: Date[];
  allowedDays: Date[];
}

/**
 * Todas las rondas conocidas del sistema.
 */
const ALL_RONDAS = [
  'ACOMODACION_1',
  'ACOMODACION_2',
  'DIECISEISAVOS',
  'RONDA_6',
  'RONDA_5',
  'OCTAVOS',
  'CUARTOS',
  'SEMIFINAL',
  'FINAL',
];

/**
 * Mapea cada ronda a los días preferidos y permitidos del torneo.
 *
 * Distribución según duración:
 * - 1 día:  Todo en día 1
 * - 2 días: Día 1 = ACOM_1 + ACOM_2; Día 2 = bracket + finales
 * - 3 días: Día 1 = ACOM_1; Día 2 = ACOM_2 + bracket temprano; Día 3 = semis + finales
 * - 4 días: Día 1 = ACOM_1; Día 2 = ACOM_2; Día 3 = bracket; Día 4 = semis + finales
 * - 5+ días: Día 1 = ACOM_1; Día 2 = ACOM_2; Días intermedios = bracket repartido; N-1 = semis; N = finales
 *
 * `allowedDays` incluye ± 1 día adyacente como fallback.
 */
export function buildRoundDayMap(availableDays: Date[]): Map<string, RoundDayConfig> {
  const N = availableDays.length;
  const map = new Map<string, RoundDayConfig>();

  // Helper: clamp index to valid range
  const day = (i: number) => availableDays[Math.max(0, Math.min(i, N - 1))];

  // Helper: get days from index range (inclusive), clamped
  const daysRange = (from: number, to: number): Date[] => {
    const result: Date[] = [];
    for (let i = Math.max(0, from); i <= Math.min(to, N - 1); i++) {
      result.push(availableDays[i]);
    }
    return result;
  };

  // Helper: preferred + ±1 neighbors
  const withNeighbors = (preferred: Date[]): Date[] => {
    const allSet = new Set<string>();
    for (const d of preferred) {
      const idx = availableDays.findIndex((ad) => dateKey(ad) === dateKey(d));
      if (idx >= 0) {
        if (idx > 0) allSet.add(dateKey(availableDays[idx - 1]));
        allSet.add(dateKey(availableDays[idx]));
        if (idx < N - 1) allSet.add(dateKey(availableDays[idx + 1]));
      }
    }
    return availableDays.filter((d) => allSet.has(dateKey(d)));
  };

  if (N === 0) {
    // No days — return empty configs for all rounds
    for (const ronda of ALL_RONDAS) {
      map.set(ronda, { preferredDays: [], allowedDays: [] });
    }
    return map;
  }

  // Build preferred days per round group
  let acom1Pref: Date[];
  let acom2Pref: Date[];
  let bracketPref: Date[]; // DIECISEISAVOS, OCTAVOS, CUARTOS
  let semiPref: Date[];
  let finalPref: Date[];

  if (N === 1) {
    acom1Pref = acom2Pref = bracketPref = semiPref = finalPref = [day(0)];
  } else if (N === 2) {
    acom1Pref = [day(0)];
    acom2Pref = [day(0)];
    bracketPref = [day(1)];
    semiPref = [day(1)];
    finalPref = [day(1)];
  } else if (N === 3) {
    acom1Pref = [day(0)];
    acom2Pref = [day(1)];
    bracketPref = [day(1)];
    semiPref = [day(2)];
    finalPref = [day(2)];
  } else if (N === 4) {
    acom1Pref = [day(0)];
    acom2Pref = [day(1)];
    bracketPref = [day(2)];
    semiPref = [day(3)];
    finalPref = [day(3)];
  } else {
    // 5+ days: spread bracket across middle days
    acom1Pref = [day(0)];
    acom2Pref = [day(1)];
    bracketPref = daysRange(2, N - 3); // middle days
    if (bracketPref.length === 0) bracketPref = [day(2)]; // safety
    semiPref = [day(N - 2)];
    finalPref = [day(N - 1)];
  }

  // Set configs
  const setRound = (ronda: string, preferred: Date[]) => {
    map.set(ronda, {
      preferredDays: preferred,
      allowedDays: withNeighbors(preferred),
    });
  };

  setRound('ACOMODACION_1', acom1Pref);
  setRound('ACOMODACION_2', acom2Pref);
  setRound('DIECISEISAVOS', bracketPref);
  setRound('RONDA_6', bracketPref);
  setRound('RONDA_5', bracketPref);
  setRound('OCTAVOS', bracketPref);
  setRound('CUARTOS', bracketPref);
  setRound('SEMIFINAL', semiPref);
  setRound('FINAL', finalPref);

  return map;
}

/**
 * Retorna true si la fecha es un "día de finales" (preferido para SEMIFINAL o FINAL).
 */
export function isFinalDay(
  fecha: Date,
  roundDayMap: Map<string, RoundDayConfig>,
): boolean {
  const dk = dateKey(fecha);
  const semiConfig = roundDayMap.get('SEMIFINAL');
  const finalConfig = roundDayMap.get('FINAL');
  if (semiConfig?.preferredDays.some((d) => dateKey(d) === dk)) return true;
  if (finalConfig?.preferredDays.some((d) => dateKey(d) === dk)) return true;
  return false;
}
