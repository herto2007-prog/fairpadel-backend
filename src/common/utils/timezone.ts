// Configuración de zona horaria para FairPadel
// Paraguay - America/Asuncion

export const TIMEZONE = 'America/Asuncion';

/**
 * Obtiene la fecha/hora actual en zona horaria de Paraguay
 */
export function getNow(): Date {
  return new Date();
}

/**
 * Formatea una fecha para mostrar en hora paraguaya
 */
export function formatDatePY(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-PY', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Convierte una fecha local a UTC para guardar en BD
 */
export function toUTC(date: Date): Date {
  return new Date(date.toISOString());
}

/**
 * Obtiene solo la fecha (YYYY-MM-DD) en hora paraguaya
 */
export function getDateStringPY(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
