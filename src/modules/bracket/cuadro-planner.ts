/**
 * PLANIFICADOR DE CUADRO (puro, sin DB) — el "cerebro" del nuevo motor de generación.
 *
 * Dada la cantidad de parejas, calcula la ESTRUCTURA del cuadro según el spec
 * acordado con Héctor (2026-06-30):
 *
 *  - Zona = partido de cortesía (1 por pareja; impar → 1 bye al mejor sembrado).
 *  - Llave = potencia de 2 MÁS CERCANA (empate → la más chica).
 *      · Redondeo ABAJO  → los perdedores que sobran juegan una RONDA (solo
 *        perdedores) por los lugares que faltan. El ganador de zona va SIEMPRE
 *        directo a la llave, NUNCA a la ronda.
 *      · Redondeo ARRIBA → byes (a los mejores) llenan los lugares vacíos; sin ronda.
 *  - Todos juegan ≥2 partidos. Total = floor(N/2) + N − 1 (idéntico al formato actual).
 *
 * Es PURO y determinístico → se verifica contra la tabla maestra (cuadro-planner.spec.ts).
 * El armado del grafo real (nodos + enlaces + siembra) se construye encima de esto.
 */

export type ModeloCuadro = 'justa' | 'ronda' | 'siembra';

export interface PlanCuadro {
  parejas: number;
  llave: number; // tamaño del bracket (potencia de 2)
  modelo: ModeloCuadro;
  zonaPartidos: number; // partidos REALES de zona (sin contar el bye)
  zonaBye: boolean; // true si una pareja (cabeza de serie) queda libre en zona
  rondaPartidos: number; // partidos de la ronda (solo perdedores). 0 si no hay ronda
  rondaGrupos: number[]; // tamaños de los mini-cuadros de la ronda (uno por cupo a llenar)
  byesLlave: number; // cupos vacíos de la llave → a los mejores rankeados (modelo siembra)
  fasesLlave: { fase: string; partidos: number }[]; // rondas del bracket
  totalPartidos: number;
}

function pow2le(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}
function pow2ge(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function fasesLlave(B: number): { fase: string; partidos: number }[] {
  const out: { fase: string; partidos: number }[] = [];
  if (B >= 64) out.push({ fase: 'TREINTAYDOSAVOS', partidos: 32 });
  if (B >= 32) out.push({ fase: 'DIECISEISAVOS', partidos: 16 });
  if (B >= 16) out.push({ fase: 'OCTAVOS', partidos: 8 });
  if (B >= 8) out.push({ fase: 'CUARTOS', partidos: 4 });
  out.push({ fase: 'SEMIS', partidos: 2 });
  out.push({ fase: 'FINAL', partidos: 1 });
  return out;
}

/**
 * Reparte `losers` perdedores en `slots` mini-cuadros (uno por cupo a llenar).
 * Cada mini-cuadro elimina hasta dejar 1 → matches = tamaño − 1. La suma de
 * (tamaño − 1) = losers − slots = partidos de ronda.
 */
function gruposRonda(losers: number, slots: number): number[] {
  if (slots <= 0) return [];
  const base = Math.floor(losers / slots);
  const resto = losers % slots;
  const grupos: number[] = [];
  for (let i = 0; i < slots; i++) grupos.push(base + (i < resto ? 1 : 0));
  return grupos;
}

export function planificarCuadro(parejas: number): PlanCuadro {
  if (parejas < 3) throw new Error('Mínimo 3 parejas');

  const zonaPartidos = Math.floor(parejas / 2);
  const zonaBye = parejas % 2 === 1;
  const ganadores = Math.floor(parejas / 2);
  const perdedores = Math.floor(parejas / 2);

  const bLow = pow2le(parejas);
  const bHigh = pow2ge(parejas);

  let llave: number;
  let modelo: ModeloCuadro;
  let rondaPartidos = 0;
  let rondaGrupos: number[] = [];
  let byesLlave = 0;

  if (bLow === bHigh) {
    // Potencia exacta: todos entran, zona siembra, sin ronda ni byes.
    llave = parejas;
    modelo = 'justa';
  } else if (parejas - bLow <= bHigh - parejas) {
    // Más cerca de la potencia de abajo → RONDA (solo perdedores).
    llave = bLow;
    modelo = 'ronda';
    const directos = ganadores + (zonaBye ? 1 : 0); // ganadores + cabeza de serie
    const cuposRonda = llave - directos; // lugares de la llave que llenan los perdedores
    rondaGrupos = gruposRonda(perdedores, cuposRonda);
    rondaPartidos = perdedores - cuposRonda; // = parejas − llave
  } else {
    // Más cerca de la potencia de arriba → SIEMBRA (byes a los mejores).
    llave = bHigh;
    modelo = 'siembra';
    byesLlave = llave - parejas;
  }

  const fll = fasesLlave(llave);
  const partidosLlave = fll.reduce((a, f) => a + f.partidos, 0) - byesLlave; // byes no se juegan
  const totalPartidos = zonaPartidos + rondaPartidos + partidosLlave;

  return {
    parejas,
    llave,
    modelo,
    zonaPartidos,
    zonaBye,
    rondaPartidos,
    rondaGrupos,
    byesLlave,
    fasesLlave: fll,
    totalPartidos,
  };
}
