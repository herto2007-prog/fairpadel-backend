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
  const porId = (nodos: NodoCuadro[]) => new Map(nodos.map((n) => [n.id, n]));

  it('cantidad de nodos = total real + el partido bye de zona (que no se juega)', () => {
    for (const n of Ns) {
      const { plan, nodos } = armarGrafo(n);
      expect(nodos.length).toBe(plan.totalPartidos + (plan.zonaBye ? 1 : 0));
    }
  });

  it('todo partido de la llave queda alimentado por 2 orígenes (byes colapsados, sin huecos)', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const llave = nodos.filter((x) => x.id.startsWith('LL-'));
      for (const m of llave) {
        expect(m.origen1Id).toBeDefined();
        expect(m.origen2Id).toBeDefined();
      }
    }
  });

  it('los byes de llave se colapsan: partidos de 1ª ronda jugados = B/2 − byesLlave', () => {
    for (const n of Ns) {
      const { plan, nodos } = armarGrafo(n);
      const fase1 = primeraFaseLlave(plan.llave);
      const jugadosPrimeraRonda = nodos.filter((x) => x.fase === fase1).length;
      expect(jugadosPrimeraRonda).toBe(plan.llave / 2 - plan.byesLlave);
    }
  });

  it('enlaces consistentes: solo la final no tiene siguiente; nadie apunta a un nodo inexistente', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const ids = new Set(nodos.map((x) => x.id));
      const final = nodos.find((x) => x.fase === 'FINAL')!;
      expect(final.siguienteId).toBeUndefined();
      for (const m of nodos) {
        if (m.siguienteId) expect(ids.has(m.siguienteId)).toBe(true);
        if (m.perdedorSiguienteId) expect(ids.has(m.perdedorSiguienteId)).toBe(true);
        if (m.origen1Id) expect(ids.has(m.origen1Id)).toBe(true);
        if (m.origen2Id) expect(ids.has(m.origen2Id)).toBe(true);
      }
    }
  });

  it('todo perdedor está enrutado: cada zona real tiene a dónde mandar su perdedor', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const zonasReales = nodos.filter((x) => x.fase === 'ZONA' && !x.esBye);
      for (const z of zonasReales) {
        expect(z.siguienteId).toBeDefined();          // ganador → llave
        expect(z.perdedorSiguienteId).toBeDefined();  // perdedor → ronda o llave
        expect(z.siguienteId).not.toBe(z.perdedorSiguienteId);
      }
      // el bye de zona pasa solo: tiene ganador, no tiene perdedor
      const bye = nodos.find((x) => x.id === 'Z-BYE');
      if (bye) {
        expect(bye.siguienteId).toBeDefined();
        expect(bye.perdedorSiguienteId).toBeUndefined();
      }
    }
  });

  it('GANADOR nunca a la ronda: a un partido de RONDA un origen-zona entra solo como PERDEDOR', () => {
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const id = porId(nodos);
      const ronda = nodos.filter((x) => x.fase === 'RONDA');
      for (const r of ronda) {
        for (const [oid, esPerd] of [
          [r.origen1Id, r.origen1EsPerdedor],
          [r.origen2Id, r.origen2EsPerdedor],
        ] as const) {
          if (!oid) continue;
          const origen = id.get(oid)!;
          if (origen.fase === 'ZONA') expect(esPerd).toBe(true);  // zona → ronda = su perdedor
          else expect(!!esPerd).toBe(false);                      // ronda → ronda = su ganador
        }
      }
    }
  });

  it('sin reencuentros: en 1ª ronda los dos lados de cada partido vienen de zonas distintas', () => {
    // Zonas que alimentan a cada nodo (subiendo por los orígenes).
    const zonasDe = (id: string, idx: Map<string, NodoCuadro>, memo: Map<string, Set<string>>): Set<string> => {
      if (memo.has(id)) return memo.get(id)!;
      const n = idx.get(id)!;
      const out = new Set<string>();
      if (n.fase === 'ZONA') out.add(n.id);
      for (const oid of [n.origen1Id, n.origen2Id]) {
        if (oid) for (const z of zonasDe(oid, idx, memo)) out.add(z);
      }
      memo.set(id, out);
      return out;
    };
    for (const n of Ns) {
      const { nodos } = armarGrafo(n);
      const idx = porId(nodos);
      const memo = new Map<string, Set<string>>();
      // Garantía real: cuando dos FUENTES (zona/ronda) entran juntas a un mismo
      // partido (1ª ronda), vienen de zonas distintas. Cruzarse más adelante
      // (cuartos/semis) es normal y se acepta (mantiene el balance del cuadro).
      for (const m of nodos) {
        const o1 = m.origen1Id ? idx.get(m.origen1Id)! : null;
        const o2 = m.origen2Id ? idx.get(m.origen2Id)! : null;
        if (!o1 || !o2) continue;
        const esFuente = (n: NodoCuadro) => n.fase === 'ZONA' || n.fase === 'RONDA';
        if (!esFuente(o1) || !esFuente(o2)) continue; // solo entradas inmediatas
        const z1 = zonasDe(o1.id, idx, memo);
        const z2 = zonasDe(o2.id, idx, memo);
        const comparten = [...z1].some((z) => z2.has(z));
        expect(comparten).toBe(false);
      }
    }
  });

  it('siembra: las dos mejores cabezas (seed 1 y 2) caen en mitades opuestas', () => {
    for (const n of Ns) {
      const { plan } = armarGrafo(n);
      const orden = ordenSiembra(plan.llave);
      const pos1 = orden.indexOf(1);
      const pos2 = orden.indexOf(2);
      const mitad = plan.llave / 2;
      const lado1 = Math.floor(pos1 / 2) < mitad / 2;
      const lado2 = Math.floor(pos2 / 2) < mitad / 2;
      expect(lado1).not.toBe(lado2);
    }
  });

  it('caso 12 parejas (ronda): 6 zona + 4 ronda + 7 llave = 17 nodos, sin byes', () => {
    const { plan, nodos } = armarGrafo(12);
    expect(plan.modelo).toBe('ronda');
    expect(nodos.filter((x) => x.fase === 'ZONA').length).toBe(6);
    expect(nodos.filter((x) => x.fase === 'RONDA').length).toBe(4);
    expect(nodos.filter((x) => x.id.startsWith('LL-')).length).toBe(7);
    expect(nodos.length).toBe(17);
  });

  it('caso 10 parejas (ronda con grupo de tamaño 1): el perdedor solo va DIRECTO a la llave', () => {
    const { plan, nodos } = armarGrafo(10);
    expect(plan.modelo).toBe('ronda');
    expect(plan.rondaGrupos).toContain(1); // hay al menos un grupo de tamaño 1
    // alguna zona manda su PERDEDOR directo a un partido de llave (no a la ronda)
    const id = new Map(nodos.map((x) => [x.id, x]));
    const zonas = nodos.filter((x) => x.fase === 'ZONA' && !x.esBye);
    const directos = zonas.filter((z) => id.get(z.perdedorSiguienteId!)!.id.startsWith('LL-'));
    expect(directos.length).toBeGreaterThan(0);
    // y ese perdedor entra al slot marcado como perdedor
    for (const z of directos) {
      const dest = id.get(z.perdedorSiguienteId!)!;
      const esPerd = z.posPerdedorEnSiguiente === 1 ? dest.origen1EsPerdedor : dest.origen2EsPerdedor;
      expect(esPerd).toBe(true);
    }
  });

  it('caso 13 parejas (siembra): llave 16, 3 byes a los mejores, sin partidos fantasma', () => {
    const { plan, nodos } = armarGrafo(13);
    expect(plan.modelo).toBe('siembra');
    expect(plan.byesLlave).toBe(3);
    // octavos jugados = 8 − 3 = 5
    expect(nodos.filter((x) => x.fase === 'OCTAVOS').length).toBe(5);
    // ningún nodo quedó con entrada 'BYE' (los byes se colapsaron)
    expect(nodos.some((x) => x.entrada1 === 'BYE' || x.entrada2 === 'BYE')).toBe(false);
    expect(nodos.length).toBe(19); // 18 jugados + 1 bye de zona
  });
});

function primeraFaseLlave(B: number): string {
  if (B >= 64) return 'TREINTAYDOSAVOS';
  if (B >= 32) return 'DIECISEISAVOS';
  if (B >= 16) return 'OCTAVOS';
  return 'CUARTOS';
}
