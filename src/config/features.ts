/**
 * Configuración de Feature Flags
 * 
 * Permite activar/desactivar funcionalidades sin necesidad de deploy.
 * Las variables se leen de process.env.
 */

export const FEATURES = {
  /**
   * Nuevo algoritmo de cálculo de descansos entre partidos.
   * 
   * Cuando está activo, usa DescansoCalculatorService en lugar de
   * la lógica legacy de descanso.
   * 
   * Valor: 'true' para activar, cualquier otro para mantener legacy
   */
  DESCANSO_CALCULATOR_V2: process.env.FEATURE_DESCANSO_V2 === 'true',

  /**
   * ID de torneo específico para probar el nuevo algoritmo.
   * Si se especifica, solo ese torneo usará el nuevo algoritmo.
   * 
   * Ejemplo: FEATURE_DESCANSO_V2_TORNEO_ID=abc123
   */
  DESCANSO_CALCULATOR_V2_TORNEO_ID: process.env.FEATURE_DESCANSO_V2_TORNEO_ID || null,
};

/**
 * Verifica si el nuevo algoritmo de descanso está activo para un torneo específico.
 * 
 * @param tournamentId - ID del torneo a verificar
 * @returns true si debe usar el nuevo algoritmo
 */
export function isDescansoV2Enabled(tournamentId?: string): boolean {
  // Si no está activado globalmente, retornar false
  if (!FEATURES.DESCANSO_CALCULATOR_V2) {
    return false;
  }

  // Si hay un torneo específico configurado, solo activar para ese
  if (FEATURES.DESCANSO_CALCULATOR_V2_TORNEO_ID) {
    return tournamentId === FEATURES.DESCANSO_CALCULATOR_V2_TORNEO_ID;
  }

  // Activado globalmente para todos los torneos
  return true;
}
