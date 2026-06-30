/**
 * Configuración compartida de la AGENDA (programación de partidos).
 *
 * Fuente ÚNICA de verdad para el asignador (`asignacion-slots.service`) y el
 * auditor (`fixture-auditoria.service`): si divergen, el auditor marca críticos
 * falsos sobre lo que el asignador produjo a propósito. Manténganlos acá.
 *
 * NOTA: el descanso por defecto sirve para formatos de puntuación CORTOS
 * (sets reducidos / super tie-break), que es lo común en amateur. Para 2-de-3
 * sets completos el estándar federado pediría ~120 min. Cuando el formato sea
 * configurable por torneo (presets, Fase 2), este valor pasa a ser el default
 * y el torneo puede subirlo.
 */

/** Descanso mínimo (min) entre el fin de un partido y el inicio del siguiente
 *  del mismo jugador, y entre un partido y su origen en el cuadro. */
export const DESCANSO_MIN = 90;

/** Máximo de partidos por día por jugador. */
export const MAX_POR_DIA = 3;
