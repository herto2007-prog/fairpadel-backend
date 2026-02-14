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
