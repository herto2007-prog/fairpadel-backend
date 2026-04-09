/**
 * Utilidades para normalizar números de teléfono
 * 
 * Meta envía números en formato internacional sin +: 595982985928
 * Los usuarios pueden guardar de varias formas: 0982985928, 982 985928, etc.
 * 
 * Esta utilidad normaliza todo a un formato estándar para comparación.
 */

/**
 * Normaliza un número de teléfono para almacenamiento y comparación
 * 
 * Reglas:
 * - Elimina espacios, guiones, paréntesis, puntos
 * - Convierte números locales de Paraguay (0xxx) a internacional (595xxx)
 * - Elimina el símbolo + si existe
 * - Retorna solo dígitos
 * 
 * Ejemplos:
 * - "0982 985928" → "595982985928"
 * - "+595 982 985928" → "595982985928"
 * - "595982985928" → "595982985928"
 * - "982-985928" → "595982985928"
 */
export function normalizarTelefono(telefono: string | null | undefined): string | null {
  if (!telefono) return null;

  // Eliminar todo excepto dígitos
  let limpio = telefono.replace(/\D/g, '');

  if (limpio.length === 0) return null;

  // Si empieza con 0 (formato local paraguayo), convertir a internacional
  // 0982... → 595982...
  if (limpio.startsWith('0')) {
    limpio = '595' + limpio.substring(1);
  }

  // Si no tiene código de país, asumir Paraguay (595)
  // Esto es para números de 9 dígitos como "982985928"
  if (limpio.length === 9 && !limpio.startsWith('595')) {
    limpio = '595' + limpio;
  }

  return limpio;
}

/**
 * Formatea un número para mostrar al usuario
 * Formato: +595 982 985928
 */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return '';

  const normalizado = normalizarTelefono(telefono);
  if (!normalizado) return '';

  // Formato: +595 982 985928
  if (normalizado.length === 12 && normalizado.startsWith('595')) {
    return `+${normalizado.slice(0, 3)} ${normalizado.slice(3, 6)} ${normalizado.slice(6)}`;
  }

  // Si no coincide con el formato esperado, devolver el normalizado con +
  return '+' + normalizado;
}

/**
 * Verifica si un número es válido para Paraguay
 */
export function esTelefonoValidoParaguay(telefono: string | null | undefined): boolean {
  if (!telefono) return false;

  const normalizado = normalizarTelefono(telefono);
  if (!normalizado) return false;

  // Debe tener 12 dígitos para Paraguay (595 + 9 dígitos)
  // o 11 dígitos (sin el 9 inicial que a veces se omite)
  return normalizado.length >= 11 && normalizado.length <= 12 && normalizado.startsWith('595');
}
