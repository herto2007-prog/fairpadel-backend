/**
 * GRAFO DEL CUADRO (puro, sin DB) — sobre `cuadro-planner`.
 *
 * Arma la lista de partidos con sus enlaces (quién alimenta a quién) y la
 * SIEMBRA (posiciones en la llave), según el spec. La siembra usa un ORDEN de
 * entrada (ranking); como el origen del ranking está por definir, acá el orden
 * es determinístico (ganadores de zona antes que perdedores; los mejores reciben
 * los byes y los cruces favorables). La ESTRUCTURA (enlaces, byes a los mejores,
 * fases) es correcta sea cual sea el ranking.
 *
 * Verificado en cuadro-grafo.spec.ts.
 */
import { planificarCuadro, PlanCuadro } from './cuadro-planner';

export interface NodoCuadro {
  id: string;
  fase: string;                 // ZONA | RONDA | <fase de llave>
  // Entrantes "hoja" (zona/ronda r1): etiqueta de pareja (p.ej. "P3"). Para
  // partidos que dependen de otros, se usan origen1Id/origen2Id.
  entrada1?: string;
  entrada2?: string;
  origen1Id?: string;           // ganador de ese nodo entra en la posición 1
  origen2Id?: string;           // ganador de ese nodo entra en la posición 2
  siguienteId?: string;         // el ganador avanza a este partido
  posEnSiguiente?: 1 | 2;
  esBye?: boolean;              // partido "fantasma": el rival está libre (no se juega)
}

export interface CuadroGrafo {
  plan: PlanCuadro;
  nodos: NodoCuadro[];
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
  // nivel 0 = final (1 partido), nivel k = 2^k partidos. Guardamos por nivel.
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
  // Slots de entrada a la llave, en orden de POSICIÓN (0..B-1).
  const slots: { matchId: string; pos: 1 | 2 }[] = [];
  for (let i = 0; i < primeraRonda.length; i++) {
    slots.push({ matchId: primeraRonda[i].id, pos: 1 });
    slots.push({ matchId: primeraRonda[i].id, pos: 2 });
  }
  // Mapa seed (1..B) → índice de slot, según el orden de siembra.
  const orden = ordenSiembra(B);
  const slotPorSeed = new Map<number, number>();
  orden.forEach((seed, idx) => slotPorSeed.set(seed, idx));
  const slotDeSeed = (seed: number) => slots[slotPorSeed.get(seed)!];

  // ── 2. Fuentes de entrada a la llave, en orden de ranking (1 = mejor) ──
  // Construimos una lista de "fuentes" ordenada por jerarquía; la fuente de
  // ranking r ocupa la posición de siembra `seed = r`.
  type Fuente =
    | { tipo: 'GANADOR_ZONA'; zona: number }
    | { tipo: 'BYE_ZONA' }
    | { tipo: 'PERDEDOR_DIRECTO'; zona: number }   // solo en 'justa': el perdedor entra directo
    | { tipo: 'RONDA'; grupo: number }
    | { tipo: 'BYE_LLAVE' };                        // cupo vacío (siembra)

  const fuentes: Fuente[] = [];
  const numZona = plan.zonaPartidos;

  if (plan.modelo === 'justa') {
    // N = B. Todos entran. Ganadores (mejor mitad) + perdedores (peor mitad).
    for (let z = 0; z < numZona; z++) fuentes.push({ tipo: 'GANADOR_ZONA', zona: z });
    for (let z = 0; z < numZona; z++) fuentes.push({ tipo: 'PERDEDOR_DIRECTO', zona: z });
  } else if (plan.modelo === 'siembra') {
    // N < B. Byes (mejores) + ganadores + (bye de zona) + perdedores.
    for (let b = 0; b < plan.byesLlave; b++) fuentes.push({ tipo: 'BYE_LLAVE' });
    if (plan.zonaBye) fuentes.push({ tipo: 'BYE_ZONA' });
    for (let z = 0; z < numZona; z++) fuentes.push({ tipo: 'GANADOR_ZONA', zona: z });
    for (let z = 0; z < numZona; z++) fuentes.push({ tipo: 'PERDEDOR_DIRECTO', zona: z });
  } else {
    // 'ronda': directos (bye + ganadores) arriba; sobrevivientes de ronda abajo.
    if (plan.zonaBye) fuentes.push({ tipo: 'BYE_ZONA' });
    for (let z = 0; z < numZona; z++) fuentes.push({ tipo: 'GANADOR_ZONA', zona: z });
    for (let g = 0; g < plan.rondaGrupos.length; g++) fuentes.push({ tipo: 'RONDA', grupo: g });
  }
  // La lista debe tener exactamente B fuentes (una por posición de la llave).
  // (Lo verifica el test; si falla, el spec/planner no cuadra.)

  // ── 3. Nodos de ZONA y RONDA + enlaces a sus slots ─────────────────────
  // Zona: 1 partido por par de parejas. Etiquetamos parejas como P1..Pn.
  const zonaNodos: NodoCuadro[] = [];
  let parejaSeq = 1;
  for (let z = 0; z < numZona; z++) {
    const nodo: NodoCuadro = {
      id: `Z-${z}`, fase: 'ZONA',
      entrada1: `P${parejaSeq++}`, entrada2: `P${parejaSeq++}`,
    };
    zonaNodos.push(nodo);
    nodos.push(nodo);
  }
  const byeZonaPareja = plan.zonaBye ? `P${parejaSeq++}` : null;

  // Ronda: por cada grupo, un mini-cuadro de eliminación entre perdedores.
  // Devuelve el id del nodo cuyo ganador es el sobreviviente del grupo.
  const rondaSurvivorId: string[] = [];
  if (plan.modelo === 'ronda') {
    // Repartir los perdedores (uno por partido de zona) en los grupos.
    const perdedoresIds = zonaNodos.map((z) => z.id); // el perdedor de Z-i
    let cursor = 0;
    plan.rondaGrupos.forEach((tam, g) => {
      const miembros = perdedoresIds.slice(cursor, cursor + tam); // ids de zona cuyos perdedores van al grupo
      cursor += tam;
      rondaSurvivorId.push(construirMiniCuadro(miembros, g, nodos));
    });
  }

  // ── 4. Conectar cada fuente a su slot de llave (por ranking → siembra) ──
  fuentes.forEach((f, rank) => {
    const seed = rank + 1;
    const slot = slotDeSeed(seed);
    const setOrigen = (originId: string) => {
      const m = nodos.find((n) => n.id === slot.matchId)!;
      if (slot.pos === 1) m.origen1Id = originId; else m.origen2Id = originId;
    };
    const setEntrada = (label: string) => {
      const m = nodos.find((n) => n.id === slot.matchId)!;
      if (slot.pos === 1) m.entrada1 = label; else m.entrada2 = label;
    };
    if (f.tipo === 'GANADOR_ZONA') {
      const zn = zonaNodos[f.zona];
      zn.siguienteId = slot.matchId; zn.posEnSiguiente = slot.pos;
      setOrigen(zn.id);
    } else if (f.tipo === 'PERDEDOR_DIRECTO') {
      // El perdedor de la zona entra directo (modelo justa). Marcamos la entrada.
      setEntrada(`PERDEDOR ${zonaNodos[f.zona].id}`);
    } else if (f.tipo === 'BYE_ZONA') {
      setEntrada(byeZonaPareja || 'BYE');
    } else if (f.tipo === 'RONDA') {
      const sid = rondaSurvivorId[f.grupo];
      const sn = nodos.find((n) => n.id === sid)!;
      sn.siguienteId = slot.matchId; sn.posEnSiguiente = slot.pos;
      setOrigen(sid);
    } else {
      // BYE_LLAVE: cupo vacío. Marcamos la entrada como BYE (no se juega).
      setEntrada('BYE');
    }
  });

  return { plan, nodos };
}

/** Construye un mini-cuadro de eliminación entre los perdedores de `zonaIds`.
 *  Devuelve el id del nodo final (su ganador es el sobreviviente). */
function construirMiniCuadro(zonaIds: string[], grupo: number, nodos: NodoCuadro[]): string {
  // Hojas: el "perdedor de Z-i". Vamos emparejando hasta que quede 1.
  let capa: { id: string; esHoja: boolean; etiqueta?: string }[] = zonaIds.map((zid) => ({
    id: zid, esHoja: true, etiqueta: `PERDEDOR ${zid}`,
  }));
  let ronda = 0;
  while (capa.length > 1) {
    const siguiente: { id: string; esHoja: boolean }[] = [];
    for (let i = 0; i < capa.length; i += 2) {
      if (i + 1 >= capa.length) {
        // impar → este pasa con BYE (no juega esta ronda)
        siguiente.push(capa[i]);
        continue;
      }
      const nodo: NodoCuadro = { id: `R-g${grupo}-r${ronda}-${i / 2}`, fase: 'RONDA' };
      // enlazar las dos entradas (hoja = perdedor de zona; o ganador del nodo previo)
      const conectar = (item: { id: string; esHoja: boolean; etiqueta?: string }, pos: 1 | 2) => {
        if (item.esHoja) {
          // el perdedor de un partido de zona alimenta esta ronda
          const zn = nodos.find((n) => n.id === item.id)!;
          // el PERDEDOR de zona va a la ronda (no el ganador)
          zn.entrada1 = zn.entrada1; // no-op; el perdedor se modela vía perdedorSiguiente conceptual
          if (pos === 1) nodo.entrada1 = item.etiqueta; else nodo.entrada2 = item.etiqueta;
        } else {
          const prev = nodos.find((n) => n.id === item.id)!;
          prev.siguienteId = nodo.id; prev.posEnSiguiente = pos;
          if (pos === 1) nodo.origen1Id = item.id; else nodo.origen2Id = item.id;
        }
      };
      conectar(capa[i], 1);
      conectar(capa[i + 1], 2);
      nodos.push(nodo);
      siguiente.push({ id: nodo.id, esHoja: false });
    }
    capa = siguiente;
    ronda++;
  }
  return capa[0].id;
}
