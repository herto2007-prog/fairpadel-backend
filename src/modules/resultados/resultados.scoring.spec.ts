import { BadRequestException } from '@nestjs/common';
import { FormatoSet3 } from '@prisma/client';
import { esSetValido, validarResultado, calcularGanador } from './padel-scoring';

/**
 * Tests de la lógica PURA de puntuación de pádel (padel-scoring.ts).
 * Extraída de ResultadosService: funciones puras sin dependencias ni BD,
 * por eso se prueban directamente.
 */
const dto = (overrides: any = {}) => ({
  set1Pareja1: 6,
  set1Pareja2: 4,
  set2Pareja1: 6,
  set2Pareja2: 3,
  formatoSet3: FormatoSet3.SET_COMPLETO,
  ...overrides,
});

describe('padel-scoring.esSetValido', () => {
  it.each([
    [6, 0],
    [6, 4],
    [7, 5],
    [7, 6],
    [0, 6],
    [4, 6],
    [5, 7],
    [6, 7],
  ])('acepta set válido %i-%i', (g1, g2) => {
    expect(esSetValido(g1, g2)).toBe(true);
  });

  it.each([
    [6, 5], // diferencia insuficiente sin llegar a 7
    [6, 6], // empate
    [7, 4], // 7 solo es válido contra 5 o 6
    [8, 6], // no se llega a 8
    [5, 5],
    [3, 3],
  ])('rechaza set inválido %i-%i', (g1, g2) => {
    expect(esSetValido(g1, g2)).toBe(false);
  });
});

describe('padel-scoring.validarResultado', () => {
  it('acepta un partido válido a 2 sets', () => {
    expect(() => validarResultado(dto())).not.toThrow();
  });

  it('rechaza un set empatado', () => {
    expect(() => validarResultado(dto({ set1Pareja1: 6, set1Pareja2: 6 }))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un set con marcador imposible (6-5)', () => {
    expect(() => validarResultado(dto({ set2Pareja1: 6, set2Pareja2: 5 }))).toThrow(
      BadRequestException,
    );
  });

  it('acepta súper tie-break válido (10-8)', () => {
    expect(() =>
      validarResultado(
        dto({ set3Pareja1: 10, set3Pareja2: 8, formatoSet3: FormatoSet3.SUPER_TIE_BREAK }),
      ),
    ).not.toThrow();
  });

  it('rechaza súper tie-break sin diferencia de 2 (10-9)', () => {
    expect(() =>
      validarResultado(
        dto({ set3Pareja1: 10, set3Pareja2: 9, formatoSet3: FormatoSet3.SUPER_TIE_BREAK }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza súper tie-break que no llega a 10 (9-7)', () => {
    expect(() =>
      validarResultado(
        dto({ set3Pareja1: 9, set3Pareja2: 7, formatoSet3: FormatoSet3.SUPER_TIE_BREAK }),
      ),
    ).toThrow(BadRequestException);
  });
});

describe('padel-scoring.calcularGanador', () => {
  const match = { inscripcion1Id: 'A', inscripcion2Id: 'B' };

  it('pareja 1 gana 2-0', () => {
    const r = calcularGanador(match, dto({ set1Pareja1: 6, set1Pareja2: 0, set2Pareja1: 6, set2Pareja2: 2 }));
    expect(r).toMatchObject({ ganadorId: 'A', perdedorId: 'B', setsGanadosP1: 2, setsGanadosP2: 0 });
  });

  it('pareja 2 gana 2-0', () => {
    const r = calcularGanador(match, dto({ set1Pareja1: 3, set1Pareja2: 6, set2Pareja1: 4, set2Pareja2: 6 }));
    expect(r).toMatchObject({ ganadorId: 'B', perdedorId: 'A', setsGanadosP1: 0, setsGanadosP2: 2 });
  });

  it('partido a 3 sets: 6-3, 3-6, 7-5 → gana pareja 1 (2-1)', () => {
    const r = calcularGanador(
      match,
      dto({ set1Pareja1: 6, set1Pareja2: 3, set2Pareja1: 3, set2Pareja2: 6, set3Pareja1: 7, set3Pareja2: 5 }),
    );
    expect(r).toMatchObject({ ganadorId: 'A', setsGanadosP1: 2, setsGanadosP2: 1 });
  });

  it('lanza error si el partido queda empatado en sets', () => {
    // 6-3, 3-6 sin tercer set → 1-1
    expect(() =>
      calcularGanador(match, dto({ set1Pareja1: 6, set1Pareja2: 3, set2Pareja1: 3, set2Pareja2: 6 })),
    ).toThrow(BadRequestException);
  });
});

/**
 * Regresión del bug corregido: en calcularGanador el tercer set se contaba
 * con `set3Pareja1 && set3Pareja2`, por lo que un set decisivo que termina
 * X-0 (ej. 6-0) NO se contaba porque el 0 es "falsy", marcando el partido
 * como 1-1 y lanzando "no puede terminar empatado". Se corrigió usando
 * `!== undefined`. Este test evita que el bug reaparezca.
 */
describe('padel-scoring.calcularGanador (regresión: 3er set X-0)', () => {
  const match = { inscripcion1Id: 'A', inscripcion2Id: 'B' };

  it('cuenta un tercer set 6-0 como victoria de la pareja 1', () => {
    const r = calcularGanador(
      match,
      dto({ set1Pareja1: 6, set1Pareja2: 3, set2Pareja1: 3, set2Pareja2: 6, set3Pareja1: 6, set3Pareja2: 0 }),
    );
    expect(r).toMatchObject({ ganadorId: 'A', setsGanadosP1: 2, setsGanadosP2: 1 });
  });
});
