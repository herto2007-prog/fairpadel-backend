/**
 * Funciones puras de cálculo del módulo de alquileres.
 *
 * Extraídas VERBATIM desde alquileres.service.ts (corte 1 del refactor de
 * deuda técnica). No tocan la base de datos ni estado del servicio: solo
 * transforman horarios, slots, fechas y hashes. Cubiertas por
 * alquileres-utils.spec.ts (caracterización con golden values).
 */

/**
 * Convierte string HH:MM a minutos desde medianoche
 * Sin usar Date (evita bugs de timezone en servidor)
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convierte minutos desde medianoche a string HH:MM
 */
export function formatTimeFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function generarSlots(
  disponibilidades: any[],
  reservas: any[],
  horariosTorneo: { sedeCanchaId: string; horaInicio: string; horaFin: string }[],
  canchaId: string,
  duracionMinutos: number = 90,
): any[] {
  const slots: any[] = [];

  for (const disp of disponibilidades) {
    // Usar minutos desde medianoche (evita Date objects)
    let minutosActual = parseTimeToMinutes(disp.horaInicio);
    let minutosFin = parseTimeToMinutes(disp.horaFin);

    // Si horaFin es 00:00, interpretar como 24:00 (medianoche del día siguiente)
    // Esto permite franjas como 22:00-00:00
    if (minutosFin === 0 && disp.horaFin === '00:00') {
      minutosFin = 24 * 60; // 1440 minutos
    }

    while (minutosActual < minutosFin) {
      const slotInicioStr = formatTimeFromMinutes(minutosActual);
      const minutosSlotFin = minutosActual + duracionMinutos;
      const slotFinStr = formatTimeFromMinutes(minutosSlotFin);

      // Si el slot excede el horario de cierre, no agregar
      if (minutosSlotFin > minutosFin) break;

      // Verificar si hay conflicto con reservas existentes
      const ocupadoPorReserva = reservas.some(r => {
        const reservaInicio = parseTimeToMinutes(r.horaInicio);
        const reservaFin = parseTimeToMinutes(r.horaFin);
        return minutosActual < reservaFin && minutosSlotFin > reservaInicio;
      });

      // Verificar si hay conflicto con torneo
      const ocupadoPorTorneo = horariosTorneo.some(h => {
        const torneoInicio = parseTimeToMinutes(h.horaInicio);
        const torneoFin = parseTimeToMinutes(h.horaFin);
        return minutosActual < torneoFin && minutosSlotFin > torneoInicio;
      });

      const ocupado = ocupadoPorReserva || ocupadoPorTorneo;

      if (!ocupado) {
        slots.push({
          horaInicio: slotInicioStr,
          horaFin: slotFinStr,
          disponible: true,
        });
      }

      minutosActual = minutosSlotFin;
    }
  }

  return slots;
}

/**
 * Helper: Obtiene el día de la semana (0-6) desde un string YYYY-MM-DD
 * Usa mediodía Paraguay para evitar problemas de timezone
 */
export function getDiaSemanaFromString(fecha: string): number {
  const [year, month, day] = fecha.split('-').map(Number);
  // Crear fecha en hora local de Paraguay (UTC-3)
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getDay();
}

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD
 */
export function diasEntre(fechaInicio: string, fechaFin: string): number {
  const d1 = new Date(`${fechaInicio}T00:00:00`);
  const d2 = new Date(`${fechaFin}T00:00:00`);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Convierte un string en un entero de 64 bits consistente
 * para usar con pg_advisory_xact_lock
 */
export function hashStringToInt64(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % Number.MAX_SAFE_INTEGER;
}
