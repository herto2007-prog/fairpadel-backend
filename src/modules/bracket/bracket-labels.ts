/**
 * Labels de procedencia para el cuadro ("Ganador de X").
 *
 * Un partido cuyo lado todavía no tiene pareja viene del GANADOR de otro partido
 * (su "origen", guardado en partidoOrigen1Id/partidoOrigen2Id). Como el cuadro es
 * determinístico, podemos decir HONESTAMENTE de dónde saldrá ese equipo aunque no
 * sepamos aún quién es: "Ganador Zona 3", "Ganador Cuartos 1", etc.
 */

export const FASE_LEGIBLE: Record<string, string> = {
  ZONA: 'Zona',
  REPECHAJE: 'Repechaje',
  TREINTAYDOSAVOS: '32avos',
  DIECISEISAVOS: '16avos',
  OCTAVOS: 'Octavos',
  CUARTOS: 'Cuartos',
  SEMIS: 'Semifinal',
  FINAL: 'Final',
};

interface OrigenRef {
  ronda: string;
  numeroRonda: number | null;
}

/**
 * El lado puede venir del GANADOR de un partido o del MEJOR PERDEDOR (repesca,
 * "perdedor con suerte" del formato Paraguayo). El prefijo lo da tipoEntrada.
 */
function prefijoEntrada(tipoEntrada?: string | null): string {
  if (tipoEntrada === 'PERDEDOR_ZONA_SUERTE') return 'Mejor perdedor';
  return 'Ganador';
}

/** "Ganador Zona 3" / "Mejor perdedor Zona 3" según el tipo de entrada. */
export function labelOrigen(
  origen?: OrigenRef | null,
  tipoEntrada?: string | null,
): string | null {
  if (!origen) return null;
  const fase = FASE_LEGIBLE[origen.ronda] || origen.ronda;
  const n = origen.numeroRonda != null ? ` ${origen.numeroRonda}` : '';
  return `${prefijoEntrada(tipoEntrada)} ${fase}${n}`;
}

interface PartidoConOrigen {
  id: string;
  ronda: string;
  numeroRonda: number | null;
  inscripcion1Id: string | null;
  inscripcion2Id: string | null;
  partidoOrigen1Id: string | null;
  partidoOrigen2Id: string | null;
  tipoEntrada1: string | null;
  tipoEntrada2: string | null;
}

/**
 * Para cada partido devuelve el label del lado que aún no tiene pareja
 * ("Ganador Zona 3"). Si el lado ya tiene pareja, su label es null.
 */
export function construirOrigenLabels(
  partidos: PartidoConOrigen[],
): Map<string, { origen1: string | null; origen2: string | null }> {
  const porId = new Map(partidos.map((p) => [p.id, p]));
  const labelDe = (origenId: string | null, tipoEntrada: string | null) =>
    origenId ? labelOrigen(porId.get(origenId), tipoEntrada) : null;

  const res = new Map<string, { origen1: string | null; origen2: string | null }>();
  for (const p of partidos) {
    res.set(p.id, {
      origen1: p.inscripcion1Id ? null : labelDe(p.partidoOrigen1Id, p.tipoEntrada1),
      origen2: p.inscripcion2Id ? null : labelDe(p.partidoOrigen2Id, p.tipoEntrada2),
    });
  }
  return res;
}
