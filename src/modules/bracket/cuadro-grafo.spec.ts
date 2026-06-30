import { armarGrafo, ordenSiembra, NodoCuadro } from './cuadro-grafo';
import { planificarCuadro } from './cuadro-planner';

describe('ordenSiembra', () => {
  it('siembra estándar: 1 arriba, 2 abajo, y mitades opuestas', () => {
    expect(ordenSiembra(2)).toEqual([1, 2]);
    expect(ordenSiembra(4)).toEqual([1, 4, 2, 3]);
    expect(ordenSiembra(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('armarGrafo — estructura del cuadro', () => {
  const Ns = Array.from({ length: 64 - 8 + 1 }, (_, i) => i + 8);

  it('la cantidad de nodos = total real + byes de llave (los byes no se juegan)', () => {
    for (const n of Ns) {
      const { plan, nodos } = armarGrafo(n);
      expect(nodos.length).toBe(plan.totalPartidos + plan.byesLlave);
    }
  });

  it('todos los slots de entrada a la llave quedan ocupados (fuentes = tamaño de llave)', () => {
    for (const n of Ns) {
      const { plan, nodos } = armarGrafo(n);
      const fase1 = primeraFaseLlave(plan.llave);
      const entradaLlave = nodos.filter((x) => x.fase === fase1);
      for (const m of entradaLlave) {
        const p1 = m.origen1Id || m.entrada1;
        const p2 = m.origen2Id || m.entrada2;
        expect(p1).toBeDefined();
        expect(p2).toBeDefined();
      }
    }
  });

  it('enlaces consistentes: cada partido (salvo la final) avanza a un siguiente; la final no', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const final = nodos.find((x) => x.fase === 'FINAL')!;
      expect(final.siguienteId).toBeUndefined();
      // cada nodo interno de llave (no primera ronda) debe ser alcanzado por 2 orígenes o entradas
      const internos = nodos.filter((x) => x.id.startsWith('LL-') && (x.origen1Id || x.origen2Id || x.id === final.id));
      for (const m of internos) {
        const lleno1 = m.origen1Id || m.entrada1;
        const lleno2 = m.origen2Id || m.entrada2;
        expect(lleno1).toBeDefined();
        expect(lleno2).toBeDefined();
      }
    }
  });

  it('siembra: las dos mejores cabezas (seed 1 y 2) caen en mitades opuestas (solo se cruzan en la final)', () => {
    for (const n of Ns) {
      const { plan } = armarGrafo(n);
      const orden = ordenSiembra(plan.llave);
      const pos1 = orden.indexOf(1);
      const pos2 = orden.indexOf(2);
      const mitad = plan.llave / 2;
      // pos son índices de slot (0..B-1); el partido de 1ª ronda = floor(pos/2)
      const lado1 = Math.floor(pos1 / 2) < mitad / 2;
      const lado2 = Math.floor(pos2 / 2) < mitad / 2;
      expect(lado1).not.toBe(lado2);
    }
  });

  it('GANADOR nunca a la ronda: los nodos de RONDA solo reciben PERDEDORES', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const ronda = nodos.filter((x) => x.fase === 'RONDA');
      for (const r of ronda) {
        for (const e of [r.entrada1, r.entrada2]) {
          if (e) expect(e.startsWith('PERDEDOR')).toBe(true);
        }
      }
    }
  });

  it('caso 12 parejas: 6 zona + 4 ronda + 7 llave (8) = 17 nodos, sin byes', () => {
    const { plan, nodos } = armarGrafo(12);
    expect(plan.modelo).toBe('ronda');
    expect(nodos.filter((x) => x.fase === 'ZONA').length).toBe(6);
    expect(nodos.filter((x) => x.fase === 'RONDA').length).toBe(4);
    expect(nodos.filter((x) => x.id.startsWith('LL-')).length).toBe(7);
    expect(nodos.length).toBe(17);
  });

  it('caso 13 parejas: siembra en llave 16 con 3 byes', () => {
    const { plan, nodos } = armarGrafo(13);
    expect(plan.modelo).toBe('siembra');
    expect(plan.byesLlave).toBe(3);
    const byes = nodos.filter((x) => x.entrada1 === 'BYE' || x.entrada2 === 'BYE').length;
    expect(byes).toBe(3);
  });
});

function primeraFaseLlave(B: number): string {
  if (B >= 64) return 'TREINTAYDOSAVOS';
  if (B >= 32) return 'DIECISEISAVOS';
  if (B >= 16) return 'OCTAVOS';
  return 'CUARTOS';
}
