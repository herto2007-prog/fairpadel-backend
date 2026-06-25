// Agregaciones puras para la ficha del jugador: compañero más frecuente y
// rival más duro. Separadas del acceso a BD para poder testearlas.

export interface JugadorRef {
  id: string;
  nombre: string;
  apellido: string;
  fotoUrl?: string | null;
}

/** Compañero con el que más veces se inscribió el jugador. */
export function topCompanero(
  inscripciones: { jugador1Id: string; jugador2Id: string | null }[],
  jugadorId: string,
): { partnerId: string; veces: number } | null {
  const counts = new Map<string, number>();
  for (const i of inscripciones) {
    const partner = i.jugador1Id === jugadorId ? i.jugador2Id : i.jugador1Id;
    if (!partner || partner === jugadorId) continue;
    counts.set(partner, (counts.get(partner) ?? 0) + 1);
  }
  let best: { partnerId: string; veces: number } | null = null;
  for (const [partnerId, veces] of counts) {
    if (!best || veces > best.veces) best = { partnerId, veces };
  }
  return best;
}

export interface MatchNorm {
  rivales: JugadorRef[]; // jugadores del lado rival
  perdi: boolean; // el jugador perdió ese partido
}

/** Rival al que más veces enfrentó (desempata por más derrotas sufridas). */
export function topRival(
  matches: MatchNorm[],
): { rival: JugadorRef; jugadas: number; perdidas: number } | null {
  const faced = new Map<string, { ref: JugadorRef; jugadas: number; perdidas: number }>();
  for (const m of matches) {
    for (const r of m.rivales) {
      const e = faced.get(r.id) ?? { ref: r, jugadas: 0, perdidas: 0 };
      e.jugadas += 1;
      if (m.perdi) e.perdidas += 1;
      faced.set(r.id, e);
    }
  }
  let best: { ref: JugadorRef; jugadas: number; perdidas: number } | null = null;
  for (const e of faced.values()) {
    if (!best || e.jugadas > best.jugadas || (e.jugadas === best.jugadas && e.perdidas > best.perdidas)) {
      best = e;
    }
  }
  return best ? { rival: best.ref, jugadas: best.jugadas, perdidas: best.perdidas } : null;
}
