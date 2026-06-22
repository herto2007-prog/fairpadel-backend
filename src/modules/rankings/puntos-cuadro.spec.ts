import {
  calcularPuestosDelCuadro,
  encontrarConfigParaPosicion,
  PartidoCuadro,
} from './puntos-cuadro';

const lado = (a: string, b: string) => ({ jugador1Id: a, jugador2Id: b });

describe('calcularPuestosDelCuadro', () => {
  it('cuadro de 8: campeón, subcampeón, semis, cuartos', () => {
    const partidos: PartidoCuadro[] = [
      { ronda: 'FINAL', ganadora: lado('a1', 'a2'), perdedora: lado('b1', 'b2') },
      { ronda: 'SEMIS', ganadora: lado('a1', 'a2'), perdedora: lado('c1', 'c2') },
      { ronda: 'SEMIS', ganadora: lado('b1', 'b2'), perdedora: lado('d1', 'd2') },
      { ronda: 'CUARTOS', ganadora: lado('a1', 'a2'), perdedora: lado('e1', 'e2') },
      { ronda: 'CUARTOS', ganadora: lado('b1', 'b2'), perdedora: lado('f1', 'f2') },
      { ronda: 'CUARTOS', ganadora: lado('c1', 'c2'), perdedora: lado('g1', 'g2') },
      { ronda: 'CUARTOS', ganadora: lado('d1', 'd2'), perdedora: lado('h1', 'h2') },
    ];
    const r = calcularPuestosDelCuadro(partidos);
    expect(r.find((x) => x.posicion === '1ro')?.jugadoresIds).toEqual(['a1', 'a2']);
    expect(r.find((x) => x.posicion === '2do')?.jugadoresIds).toEqual(['b1', 'b2']);
    expect(r.filter((x) => x.posicion === '3ro-4to')).toHaveLength(2);
    expect(r.filter((x) => x.posicion === '5to-8vo')).toHaveLength(4);
  });

  it('cuadro grande: 16avos y 32avos SÍ otorgan puesto (antes daban cero)', () => {
    const partidos: PartidoCuadro[] = [
      { ronda: 'FINAL', ganadora: lado('a1', 'a2'), perdedora: lado('b1', 'b2') },
      { ronda: 'DIECISEISAVOS', ganadora: lado('a1', 'a2'), perdedora: lado('z1', 'z2') },
      { ronda: 'TREINTAYDOSAVOS', ganadora: lado('a1', 'a2'), perdedora: lado('w1', 'w2') },
    ];
    const r = calcularPuestosDelCuadro(partidos);
    expect(r.find((x) => x.posicion === '17mo-32do')?.jugadoresIds).toEqual(['z1', 'z2']);
    expect(r.find((x) => x.posicion === '33avo-64to')?.jugadoresIds).toEqual(['w1', 'w2']);
  });

  it('ZONA y REPECHAJE no otorgan puesto', () => {
    const partidos: PartidoCuadro[] = [
      { ronda: 'ZONA', ganadora: lado('a1', 'a2'), perdedora: lado('b1', 'b2') },
      { ronda: 'REPECHAJE', ganadora: lado('c1', 'c2'), perdedora: lado('d1', 'd2') },
    ];
    expect(calcularPuestosDelCuadro(partidos)).toEqual([]);
  });

  it('ignora lados nulos (BYE / pareja incompleta)', () => {
    const partidos: PartidoCuadro[] = [
      { ronda: 'FINAL', ganadora: { jugador1Id: 'a1', jugador2Id: null }, perdedora: null },
    ];
    const r = calcularPuestosDelCuadro(partidos);
    expect(r).toEqual([{ posicion: '1ro', jugadoresIds: ['a1'] }]);
  });

  it('sin final, no hay campeón ni subcampeón', () => {
    const partidos: PartidoCuadro[] = [
      { ronda: 'SEMIS', ganadora: lado('a1', 'a2'), perdedora: lado('c1', 'c2') },
    ];
    const r = calcularPuestosDelCuadro(partidos);
    expect(r.find((x) => x.posicion === '1ro')).toBeUndefined();
    expect(r.find((x) => x.posicion === '3ro-4to')?.jugadoresIds).toEqual(['c1', 'c2']);
  });
});

describe('encontrarConfigParaPosicion', () => {
  const configs = [
    { posicion: '1ro', puntosBase: 100 },
    { posicion: '2do', puntosBase: 70 },
    { posicion: '3ro-4to', puntosBase: 45 },
    { posicion: '5to-8vo', puntosBase: 25 },
    { posicion: '9no-16to', puntosBase: 15 },
    { posicion: '17mo-32do', puntosBase: 10 },
    { posicion: 'participacion', puntosBase: 5 },
  ];

  it('coincidencia exacta', () => {
    expect(encontrarConfigParaPosicion(configs, '1ro')?.puntosBase).toBe(100);
    expect(encontrarConfigParaPosicion(configs, '17mo-32do')?.puntosBase).toBe(10);
  });

  it('rangos', () => {
    expect(encontrarConfigParaPosicion(configs, '5to-8vo')?.puntosBase).toBe(25);
    expect(encontrarConfigParaPosicion(configs, '9no-16to')?.puntosBase).toBe(15);
  });

  it('33avo-64to cae a participacion', () => {
    expect(encontrarConfigParaPosicion(configs, '33avo-64to')?.puntosBase).toBe(5);
  });
});
