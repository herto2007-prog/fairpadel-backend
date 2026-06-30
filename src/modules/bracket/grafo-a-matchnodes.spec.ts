import { grafoAMatchNodes } from './grafo-a-matchnodes';
import { planificarCuadro } from './cuadro-planner';
import { FaseBracket, MatchNode } from './dto/generate-bracket.dto';

describe('grafoAMatchNodes — puente a la forma del motor real', () => {
  const Ns = Array.from({ length: 64 - 8 + 1 }, (_, i) => i + 8);

  it('cantidad de partidos = total jugado + el partido bye de zona', () => {
    for (const n of Ns) {
      const plan = planificarCuadro(n);
      const { partidos } = grafoAMatchNodes(n);
      expect(partidos.length).toBe(plan.totalPartidos + (plan.zonaBye ? 1 : 0));
    }
  });

  it('config refleja el plan', () => {
    for (const n of Ns) {
      const plan = planificarCuadro(n);
      const { config } = grafoAMatchNodes(n);
      expect(config.totalParejas).toBe(n);
      expect(config.tamanoBracket).toBe(plan.llave);
      expect(config.partidosRepechaje).toBe(plan.rondaPartidos);
      expect(config.parejasConBye).toBe(plan.zonaBye ? 1 : 0);
    }
  });

  it('enlaces íntegros: todo siguiente/perdedor/origen apunta a un partido existente', () => {
    for (const n of Ns) {
      const { partidos } = grafoAMatchNodes(n);
      const ids = new Set(partidos.map((p) => p.id));
      for (const p of partidos) {
        if (p.partidoSiguienteId) expect(ids.has(p.partidoSiguienteId)).toBe(true);
        if (p.partidoPerdedorSiguienteId) expect(ids.has(p.partidoPerdedorSiguienteId)).toBe(true);
        if (p.partidoOrigen1Id) expect(ids.has(p.partidoOrigen1Id)).toBe(true);
        if (p.partidoOrigen2Id) expect(ids.has(p.partidoOrigen2Id)).toBe(true);
      }
    }
  });

  it('solo la final no tiene siguiente; cada zona real manda ganador y perdedor', () => {
    for (const n of Ns) {
      const { partidos } = grafoAMatchNodes(n);
      const final = partidos.find((p) => p.fase === FaseBracket.FINAL)!;
      expect(final.partidoSiguienteId).toBeUndefined();
      const zonasReales = partidos.filter((p) => p.fase === FaseBracket.ZONA && !p.esBye);
      for (const z of zonasReales) {
        expect(z.partidoSiguienteId).toBeDefined();
        expect(z.partidoPerdedorSiguienteId).toBeDefined();
      }
    }
  });

  it('orden 1-based y contiguo por fase', () => {
    for (const n of Ns) {
      const { partidos } = grafoAMatchNodes(n);
      const porFase = new Map<FaseBracket, MatchNode[]>();
      for (const p of partidos) {
        const arr = porFase.get(p.fase) || [];
        arr.push(p);
        porFase.set(p.fase, arr);
      }
      for (const arr of porFase.values()) {
        const ordenes = arr.map((p) => p.orden).sort((a, b) => a - b);
        expect(ordenes[0]).toBe(1);
        expect(ordenes[ordenes.length - 1]).toBe(arr.length);
        expect(new Set(ordenes).size).toBe(arr.length); // sin repetidos
      }
    }
  });

  it('BASELINE 8 parejas: 4 ZONA + 4 CUARTOS + 2 SEMIS + 1 FINAL = 11, todo enlazado', () => {
    const { partidos } = grafoAMatchNodes(8);
    const cuenta = (f: FaseBracket) => partidos.filter((p) => p.fase === f).length;
    expect(partidos.length).toBe(11);
    expect(cuenta(FaseBracket.ZONA)).toBe(4);
    expect(cuenta(FaseBracket.CUARTOS)).toBe(4);
    expect(cuenta(FaseBracket.SEMIS)).toBe(2);
    expect(cuenta(FaseBracket.FINAL)).toBe(1);
    expect(partidos.some((p) => p.fase === FaseBracket.REPECHAJE)).toBe(false);
    expect(partidos.some((p) => p.esBye)).toBe(false);
    // 8 entradas a cuartos (4 ganadores + 4 perdedores), todas con origen
    const cuartos = partidos.filter((p) => p.fase === FaseBracket.CUARTOS);
    for (const c of cuartos) {
      expect(c.partidoOrigen1Id).toBeDefined();
      expect(c.partidoOrigen2Id).toBeDefined();
    }
  });

  it('13 parejas (byes de llave): 1 partido bye de zona, octavos jugados = 5', () => {
    const { partidos } = grafoAMatchNodes(13);
    expect(partidos.filter((p) => p.fase === FaseBracket.OCTAVOS).length).toBe(5);
    expect(partidos.filter((p) => p.esBye).length).toBe(1); // el bye de zona (impar)
    expect(partidos.length).toBe(19);
  });
});
