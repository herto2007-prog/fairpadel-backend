import { planificarCuadro, PlanCuadro } from './cuadro-planner';

/** Potencia de 2 más cercana (empate → la más chica). Calculada aparte para cruzar. */
function llaveEsperada(n: number): number {
  let low = 1;
  while (low * 2 <= n) low *= 2;
  if (low === n) return n;
  const high = low * 2;
  return n - low <= high - n ? low : high;
}
const esPotencia2 = (n: number) => (n & (n - 1)) === 0;

describe('planificarCuadro — spec del formato (2026-06-30)', () => {
  const Ns = Array.from({ length: 64 - 8 + 1 }, (_, i) => i + 8); // 8..64

  it('el total es floor(N/2)+N-1 para todo N (idéntico al formato actual)', () => {
    for (const n of Ns) {
      expect(planificarCuadro(n).totalPartidos).toBe(Math.floor(n / 2) + n - 1);
    }
  });

  it('la llave es la potencia de 2 más cercana (empate → la más chica)', () => {
    for (const n of Ns) {
      expect(planificarCuadro(n).llave).toBe(llaveEsperada(n));
    }
  });

  it('el modelo es coherente con el redondeo', () => {
    for (const n of Ns) {
      const p = planificarCuadro(n);
      if (esPotencia2(n)) expect(p.modelo).toBe('justa');
      else if (p.llave < n) expect(p.modelo).toBe('ronda');   // redondeó abajo
      else expect(p.modelo).toBe('siembra');                  // redondeó arriba
    }
  });

  it('byes solo en siembra (= llave − parejas); cero en ronda/justa', () => {
    for (const n of Ns) {
      const p = planificarCuadro(n);
      if (p.modelo === 'siembra') expect(p.byesLlave).toBe(p.llave - n);
      else expect(p.byesLlave).toBe(0);
    }
  });

  it('GANADOR nunca a la ronda: los directos (ganadores+bye) entran solos; la ronda es solo de perdedores', () => {
    for (const n of Ns) {
      const p = planificarCuadro(n);
      if (p.modelo !== 'ronda') {
        expect(p.rondaPartidos).toBe(0);
        continue;
      }
      const directos = Math.floor(n / 2) + (p.zonaBye ? 1 : 0); // ganadores + cabeza de serie
      const perdedores = Math.floor(n / 2);
      // los directos caben en la llave sin pelear (no se mete ningún ganador a la ronda)
      expect(directos).toBeLessThanOrEqual(p.llave);
      // la ronda la juegan SOLO perdedores y produce exactamente los cupos restantes
      const cupos = p.llave - directos;
      expect(p.rondaPartidos).toBe(perdedores - cupos);
      expect(p.rondaPartidos).toBe(n - p.llave);
      // los grupos de la ronda suman los perdedores y cada partido elimina 1
      expect(p.rondaGrupos.reduce((a, b) => a + b, 0)).toBe(perdedores);
      expect(p.rondaGrupos.reduce((a, g) => a + (g - 1), 0)).toBe(p.rondaPartidos);
    }
  });

  it('todos juegan ≥2: zona (o bye) + al menos su entrada a la llave/ronda', () => {
    for (const n of Ns) {
      const p = planificarCuadro(n);
      // zona cubre a casi todos; el bye (si hay) entra directo a la llave (su 1er partido).
      expect(p.zonaPartidos).toBe(Math.floor(n / 2));
      expect(p.zonaBye).toBe(n % 2 === 1);
    }
  });

  it('casos puntuales de la tabla maestra', () => {
    const casos: Array<[number, Partial<PlanCuadro>]> = [
      [8, { llave: 8, modelo: 'justa', totalPartidos: 11 }],
      [9, { llave: 8, modelo: 'ronda', rondaPartidos: 1, totalPartidos: 12 }],
      [12, { llave: 8, modelo: 'ronda', rondaPartidos: 4, totalPartidos: 17 }],
      [13, { llave: 16, modelo: 'siembra', byesLlave: 3, totalPartidos: 18 }],
      [15, { llave: 16, modelo: 'siembra', byesLlave: 1, totalPartidos: 21 }],
      [16, { llave: 16, modelo: 'justa', totalPartidos: 23 }],
      [24, { llave: 16, modelo: 'ronda', totalPartidos: 35 }],
      [25, { llave: 32, modelo: 'siembra', byesLlave: 7, totalPartidos: 36 }],
      [31, { llave: 32, modelo: 'siembra', byesLlave: 1, totalPartidos: 45 }],
      [32, { llave: 32, modelo: 'justa', totalPartidos: 47 }],
      [64, { llave: 64, modelo: 'justa', totalPartidos: 95 }],
    ];
    for (const [n, esperado] of casos) {
      expect(planificarCuadro(n)).toMatchObject(esperado);
    }
  });
});
