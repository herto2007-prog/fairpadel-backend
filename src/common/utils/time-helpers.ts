/**
 * Utilidades para manejo de tiempo en formato HH:mm
 * 
 * REGLA DE ORO: NUNCA comparar horas como strings.
 * Siempre convertir a minutos (número) para comparaciones.
 */

/**
 * Convierte una hora "HH:mm" a minutos del día (0-1439)
 * Ejemplo: "14:30" → 870
 */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convierte minutos del día a hora "HH:mm"
 * Ejemplo: 870 → "14:30"
 */
export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Suma minutos a una hora y retorna la nueva hora
 * Maneja correctamente el overflow (ej: 23:00 + 120min = 01:00)
 * 
 * @returns Objeto con hora (string) y cambioDia (boolean)
 */
export function sumarMinutosAHoras(
  hora: string,
  minutosASumar: number,
): { hora: string; cambioDia: boolean } {
  const minutosTotales = horaAMinutos(hora) + minutosASumar;
  const cambioDia = minutosTotales >= 1440; // 24 * 60
  const minutosNormalizados = minutosTotales % 1440;
  
  return {
    hora: minutosAHora(minutosNormalizados),
    cambioDia,
  };
}

/**
 * Compara dos horas
 * Retorna: -1 si hora1 < hora2, 0 si iguales, 1 si hora1 > hora2
 */
export function compararHoras(hora1: string, hora2: string): number {
  const m1 = horaAMinutos(hora1);
  const m2 = horaAMinutos(hora2);
  
  if (m1 < m2) return -1;
  if (m1 > m2) return 1;
  return 0;
}

/**
 * Verifica si hora1 es mayor o igual a hora2
 */
export function horaEsMayorOIgual(hora1: string, hora2: string): boolean {
  return compararHoras(hora1, hora2) >= 0;
}

/**
 * Verifica si hora1 es estrictamente mayor a hora2
 */
export function horaEsMayor(hora1: string, hora2: string): boolean {
  return compararHoras(hora1, hora2) > 0;
}

/**
 * Obtiene la hora actual en formato HH:mm
 */
export function getHoraActual(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}

/**
 * Formatea minutos como string legible
 * Ejemplo: 270 → "4h 30m"
 */
export function formatearMinutos(minutos: number): string {
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}
