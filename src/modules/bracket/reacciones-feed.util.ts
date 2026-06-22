/**
 * Helpers PUROS para las reacciones del feed.
 *
 * El feed se arma al vuelo; cada ítem tiene un id estable derivado de su origen:
 *   - resultado de partido    -> `r-<matchId>`
 *   - inscripción de seguido   -> `i-<inscripcionId>`
 *   - torneo nuevo             -> `t-<tournamentId>`  (NO reaccionable)
 *
 * Solo las publicaciones "de personas" (resultado / inscripción) son reaccionables.
 */

export type OrigenFeed = 'resultado' | 'inscripcion' | 'torneo' | 'publicacion' | 'desconocido';

export interface FeedItemRef {
  origen: OrigenFeed;
  refId: string; // id de la entidad de origen (match / inscripcion / torneo)
}

/** Descompone un feedItemId (`r-xxx`, `i-xxx`, `t-xxx`) en { origen, refId }. */
export function parseFeedItemId(feedItemId: string): FeedItemRef {
  const idx = feedItemId.indexOf('-');
  if (idx <= 0) return { origen: 'desconocido', refId: '' };
  const prefijo = feedItemId.slice(0, idx);
  const refId = feedItemId.slice(idx + 1);
  if (!refId) return { origen: 'desconocido', refId: '' };
  switch (prefijo) {
    case 'r':
      return { origen: 'resultado', refId };
    case 'i':
      return { origen: 'inscripcion', refId };
    case 't':
      return { origen: 'torneo', refId };
    case 'p':
      return { origen: 'publicacion', refId };
    default:
      return { origen: 'desconocido', refId: '' };
  }
}

/** ¿Se puede reaccionar a este ítem? Solo publicaciones de personas. */
export function esReaccionable(feedItemId: string): boolean {
  const { origen } = parseFeedItemId(feedItemId);
  return origen === 'resultado' || origen === 'inscripcion' || origen === 'publicacion';
}
