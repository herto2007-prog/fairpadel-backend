/**
 * GRAFO DEL CUADRO (puro, sin DB) — sobre `cuadro-planner`.
 *
 * Arma la lista de partidos con sus ENLACES REALES (quién alimenta a quién,
 * tanto por el ganador como por el perdedor) y la SIEMBRA (posiciones en la
 * llave), según el spec acordado. Es una descripción COMPLETA del fixture:
 *
 *  - Cada partido de ZONA tiene `siguienteId` (a dónde va el GANADOR) y
 *    `perdedorSiguienteId` (a dónde va el PERDEDOR).
 *  - La pareja impar (cabeza de serie) juega un partido de ZONA `esBye` (pasa sola).
 *  - La RONDA (solo perdedores) son mini-cuadros; el GANADOR de zona nunca entra.
 *  - Byes de llave a los MEJORES: los seeds más BAJOS quedan vacíos, y su rival
 *    (el mejor seed) pasa directo a la 2ª ronda → el partido fantasma se COLAPSA
 *    (no se crea). Así no hace falta lógica nueva de "auto-avance de bye" aguas abajo.
 *
 * La siembra usa un ORDEN de entrada (ranking) determinístico (mejores cabezas
 * en mitades opuestas). La ESTRUCTURA es correcta sea cual sea el ranking real.
 *
 * Verificado en cuadro-grafo.spec.ts.
 */
import { planificarCuadro, PlanCuadro } from './cuadro-planner';

export interface NodoCuadro {
  id: string;
  fase: string;                 // ZONA | RONDA | <fase de llave>
  // Entrantes "hoja" (zona): etiqueta de pareja (p.ej. "P3").
  entrada1?: string;
  entrada2?: string;
  origen1Id?: string;           // de qué nodo viene el entrante de la posición 1
  origen2Id?: string;           // de qué nodo viene el entrante de la posición 2
  origen1EsPerdedor?: boolean;  // true si la pos 1 la alimenta el PERDEDOR del origen
  origen2EsPerdedor?: boolean;  // true si la pos 2 la alimenta el PERDEDOR del origen
  siguienteId?: string;         // el GANADOR avanza a este partido
  posEnSiguiente?: 1 | 2;
  perdedorSiguienteId?: string; // el PERDEDOR avanza a este partido (zona)
  posPerdedorEnSiguiente?: 1 | 2;
  esBye?: boolean;              // partido "fantasma": la pareja pasa sola (no se juega)
}

export interface CuadroGrafo {
  plan: PlanCuadro;
  nodos: NodoCuadro[];
}

interface Slot {
  matchId: string;
  pos: 1 | 2;
}

/** Orden de siembra estándar para una llave de tamaño B (posición → seed 1..B). */
export function ordenSiembra(B: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < B) {
    const suma = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(suma - s);
    }
    seeds = next;
  }
  return seeds; // length B
}

const FASE_POR_PARTIDOS: Record<number, string> = {
  32: 'TREINTAYDOSAVOS', 16: 'DIECISEISAVOS', 8: 'OCTAVOS', 4: 'CUARTOS', 2: 'SEMIS', 1: 'FINAL',
};

export function armarGrafo(parejas: number): CuadroGrafo {
  const plan = planificarCuadro(parejas);
  const B = plan.llave;
  const nodos: NodoCuadro[] = [];

  // ── 1. Árbol de la llave (de la final hacia la 1ª ronda) ──────────────
  const niveles: NodoCuadro[][] = [];
  const totalNiveles = Math.log2(B); // p.ej. B=8 → 3 (cuartos, semis, final)
  for (let nivel = 0; nivel < totalNiveles; nivel++) {
    const numPartidos = Math.pow(2, nivel); // final=1, semis=2, ...
    const fase = FASE_POR_PARTIDOS[numPartidos] || `RONDA_${numPartidos}`;
    const ronda: NodoCuadro[] = [];
    for (let i = 0; i < numPartidos; i++) {
      const nodo: NodoCuadro = { id: `LL-${fase}-${i}`, fase };
      if (nivel > 0) {
        const padre = niveles[nivel - 1][Math.floor(i / 2)];
        const pos = ((i % 2) + 1) as 1 | 2;
        nodo.siguienteId = padre.id;
        nodo.posEnSiguiente = pos;
        if (pos === 1) padre.origen1Id = nodo.id; else padre.origen2Id = nodo.id;
      }
      ronda.push(nodo);
      nodos.push(nodo);
    }
    niveles.push(ronda);
  }
  const primeraRonda = niveles[totalNiveles - 1]; // B/2 partidos

  // ── 2. Helpers de búsqueda y enlace ────────────────────────────────────
  const find = (id: string) => nodos.find((n) => n.id === id)!;
  const setOrigen = (slot: Slot, originId: string, esPerdedor: boolean) => {
    const m = find(slot.matchId);
    if (slot.pos === 1) {
      m.origen1Id = originId;
      m.origen1EsPerdedor = esPerdedor || undefined;
    } else {
      m.origen2Id = originId;
      m.origen2EsPerdedor = esPerdedor || undefined;
    }
  };
  const linkGanador = (srcId: string, slot: Slot) => {
    const s = find(srcId);
    s.siguienteId = slot.matchId;
    s.posEnSiguiente = slot.pos;
    setOrigen(slot, srcId, false);
  };
  const linkPerdedor = (zonaId: string, slot: Slot) => {
    const z = find(zonaId);
    z.perdedorSiguienteId = slot.matchId;
    z.posPerdedorEnSiguiente = slot.pos;
    setOrigen(slot, zonaId, true);
  };

  // ── 3. Siembra + colapso de byes ───────────────────────────────────────
  // slots de entrada a la llave, en orden de POSICIÓN (0..B-1).
  const slots: Slot[] = [];
  for (let i = 0; i < primeraRonda.length; i++) {
    slots.push({ matchId: primeraRonda[i].id, pos: 1 });
    slots.push({ matchId: primeraRonda[i].id, pos: 2 });
  }
  const orden = ordenSiembra(B); // orden[j] = seed que ocupa el slot j
  const numReales = B - plan.byesLlave; // entradas reales a la llave
  const esByeSeed = (seed: number) => seed > numReales; // los peores seeds quedan vacíos

  // target efectivo por seed real: normalmente su slot de 1ª ronda; si su partido
  // colapsa (el rival es un bye), pasa directo al slot del partido padre.
  const targetDeSeed = new Map<number, Slot>();
  for (let j = 0; j < slots.length; j++) targetDeSeed.set(orden[j], slots[j]);

  if (plan.byesLlave > 0) {
    for (let i = 0; i < primeraRonda.length; i++) {
      const seedA = orden[2 * i];     // pos 1 de este partido
      const seedB = orden[2 * i + 1]; // pos 2 de este partido
      const aBye = esByeSeed(seedA);
      const bBye = esByeSeed(seedB);
      if (aBye === bBye) continue; // ambos reales (partido normal) o ambos bye (no ocurre)
      const m = primeraRonda[i];
      const realSeed = aBye ? seedB : seedA;
      // el real pasa DIRECTO al partido padre (la 1ª ronda colapsa)
      targetDeSeed.set(realSeed, { matchId: m.siguienteId!, pos: m.posEnSiguiente! });
      targetDeSeed.delete(aBye ? seedA : seedB); // el seed vacío no tiene entrante
      // limpiar el origen del padre que apuntaba a m (se re-asigna al enlazar el real)
      const padre = find(m.siguienteId!);
      if (m.posEnSiguiente === 1) padre.origen1Id = undefined; else padre.origen2Id = undefined;
      // quitar el partido fantasma del grafo
      const idx = nodos.findIndex((n) => n.id === m.id);
      if (idx >= 0) nodos.splice(idx, 1);
    }
  }
  const slotDeSeed = (seed: number) => targetDeSeed.get(seed)!;

  // ── 4. Nodos de ZONA (+ bye de zona) ───────────────────────────────────
  const zonaNodos: NodoCuadro[] = [];
  let parejaSeq = 1;
  for (let z = 0; z < plan.zonaPartidos; z++) {
    const nodo: NodoCuadro = {
      id: `Z-${z}`, fase: 'ZONA',
      entrada1: `P${parejaSeq++}`, entrada2: `P${parejaSeq++}`,
    };
    zonaNodos.push(nodo);
    nodos.push(nodo);
  }
  // Pareja impar: juega un partido de ZONA `esBye` (pasa sola a la llave).
  let byeZonaNodo: NodoCuadro | null = null;
  if (plan.zonaBye) {
    byeZonaNodo = { id: 'Z-BYE', fase: 'ZONA', esBye: true, entrada1: `P${parejaSeq++}` };
    nodos.push(byeZonaNodo);
  }

  // ── 5. RONDA (solo perdedores): mini-cuadros ───────────────────────────
  type Survivor = { tipo: 'RONDA_GANADOR' | 'ZONA_PERDEDOR'; id: string };

  // Conecta una "hoja" (perdedor de zona) o un ganador de ronda a un partido de ronda.
  const conectarHijo = (hijo: { kind: 'zonaPerdedor' | 'rondaGanador'; id: string }, slot: Slot) => {
    if (hijo.kind === 'zonaPerdedor') linkPerdedor(hijo.id, slot);
    else linkGanador(hijo.id, slot);
  };

  const construirMiniCuadro = (zonaIds: string[], grupo: number): Survivor => {
    // Grupo de 1: ese único perdedor pasa directo a la llave (no juega ronda).
    if (zonaIds.length === 1) return { tipo: 'ZONA_PERDEDOR', id: zonaIds[0] };
    let capa: { kind: 'zonaPerdedor' | 'rondaGanador'; id: string }[] =
      zonaIds.map((zid) => ({ kind: 'zonaPerdedor', id: zid }));
    let ronda = 0;
    while (capa.length > 1) {
      const siguiente: typeof capa = [];
      for (let i = 0; i < capa.length; i += 2) {
        if (i + 1 >= capa.length) {
          siguiente.push(capa[i]); // impar → pasa con bye a la siguiente ronda
          continue;
        }
        const nodo: NodoCuadro = { id: `R-g${grupo}-r${ronda}-${i / 2}`, fase: 'RONDA' };
        nodos.push(nodo);
        conectarHijo(capa[i], { matchId: nodo.id, pos: 1 });
        conectarHijo(capa[i + 1], { matchId: nodo.id, pos: 2 });
        siguiente.push({ kind: 'rondaGanador', id: nodo.id });
      }
      capa = siguiente;
      ronda++;
    }
    const top = capa[0];
    return top.kind === 'zonaPerdedor'
      ? { tipo: 'ZONA_PERDEDOR', id: top.id }
      : { tipo: 'RONDA_GANADOR', id: top.id };
  };

  const survivors: Survivor[] = [];
  if (plan.modelo === 'ronda') {
    let cursor = 0;
    plan.rondaGrupos.forEach((tam, g) => {
      const miembros = zonaNodos.slice(cursor, cursor + tam).map((z) => z.id);
      cursor += tam;
      survivors.push(construirMiniCuadro(miembros, g));
    });
  }

  // ── 6. Conectores en orden de ranking (1 = mejor) → seed = rank + 1 ─────
  // Cada conector enlaza su fuente al slot que le toca. Lleva metadatos para
  // evitar que el GANADOR y el PERDEDOR de la MISMA zona se crucen en 1ª ronda.
  interface Conector {
    fn: (slot: Slot) => void;
    zonas: Set<string>;  // zonas que representa (para detectar reencuentros)
  }
  const conectores: Conector[] = [];
  const grafoGanador = (id: string): Conector => ({ fn: (s) => linkGanador(id, s), zonas: new Set([id]) });
  const grafoPerdedor = (id: string): Conector => ({ fn: (s) => linkPerdedor(id, s), zonas: new Set([id]) });

  let cursorGrupo = 0;
  if (plan.modelo === 'justa') {
    zonaNodos.forEach((z) => conectores.push(grafoGanador(z.id)));
    zonaNodos.forEach((z) => conectores.push(grafoPerdedor(z.id)));
  } else if (plan.modelo === 'siembra') {
    if (byeZonaNodo) conectores.push(grafoGanador(byeZonaNodo.id));
    zonaNodos.forEach((z) => conectores.push(grafoGanador(z.id)));
    zonaNodos.forEach((z) => conectores.push(grafoPerdedor(z.id)));
    // los `byesLlave` seeds peores quedan sin conector (slots vacíos, ya colapsados)
  } else {
    // 'ronda': directos (bye de zona + ganadores) arriba; sobrevivientes abajo.
    if (byeZonaNodo) conectores.push(grafoGanador(byeZonaNodo.id));
    zonaNodos.forEach((z) => conectores.push(grafoGanador(z.id)));
    survivors.forEach((s, g) => {
      const tam = plan.rondaGrupos[g];
      const zonasGrupo = new Set(zonaNodos.slice(cursorGrupo, cursorGrupo + tam).map((z) => z.id));
      cursorGrupo += tam;
      conectores.push({
        fn: (slot) => (s.tipo === 'RONDA_GANADOR' ? linkGanador(s.id, slot) : linkPerdedor(s.id, slot)),
        zonas: zonasGrupo,
      });
    });
  }

  // conectores.length debe ser exactamente numReales (lo verifica el spec).
  // Asignación inicial: rank → seed = rank+1. Luego se reparan los reencuentros
  // (ganador y perdedor de la MISMA zona juntos en 1ª ronda). Como el ranking de
  // entrada es determinístico/placeholder, los conectores son intercambiables:
  // un hill-climbing intercambia seeds hasta minimizar reencuentros.
  const seedAsignado = conectores.map((_, r) => r + 1);
  const matchDeSeed = (seed: number) => slotDeSeed(seed).matchId;
  const contarReencuentros = (seeds: number[]): number => {
    const porMatch = new Map<string, number[]>();
    seeds.forEach((seed, idx) => {
      const m = matchDeSeed(seed);
      const arr = porMatch.get(m);
      if (arr) arr.push(idx); else porMatch.set(m, [idx]);
    });
    let count = 0;
    for (const idxs of porMatch.values()) {
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < idxs.length; b++) {
          const za = conectores[idxs[a]].zonas;
          if ([...conectores[idxs[b]].zonas].some((z) => za.has(z))) count++;
        }
      }
    }
    return count;
  };
  let guard = 0;
  while (contarReencuentros(seedAsignado) > 0 && guard++ < 500) {
    const base = contarReencuentros(seedAsignado);
    let mejorDelta = 0, mejorI = -1, mejorJ = -1;
    for (let i = 0; i < conectores.length; i++) {
      for (let j = i + 1; j < conectores.length; j++) {
        const trial = [...seedAsignado];
        [trial[i], trial[j]] = [trial[j], trial[i]];
        const delta = base - contarReencuentros(trial);
        if (delta > mejorDelta) { mejorDelta = delta; mejorI = i; mejorJ = j; }
      }
    }
    if (mejorI < 0) break; // mínimo local sin mejora: dejar el resto (no empeora)
    [seedAsignado[mejorI], seedAsignado[mejorJ]] = [seedAsignado[mejorJ], seedAsignado[mejorI]];
  }
  conectores.forEach((c, r) => c.fn(slotDeSeed(seedAsignado[r])));

  return { plan, nodos };
}
