/**
 * Estados en los que un partido ya está DECIDIDO: no se reprograma, no se mueve
 * y no se borra al re-sortear. Incluye terminaciones por walkover/retiro/descal,
 * no solo el FINALIZADO normal.
 */
export const ESTADOS_TERMINALES = ['FINALIZADO', 'WO', 'RETIRADO', 'DESCALIFICADO'] as const;

export const esTerminal = (estado: string | null | undefined): boolean =>
  !!estado && (ESTADOS_TERMINALES as readonly string[]).includes(estado);
