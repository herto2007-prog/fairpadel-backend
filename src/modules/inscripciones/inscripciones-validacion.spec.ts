import {
  validarReglasCategoria,
  validarCategoriaParaPareja,
  cuadroYaArmado,
  jugadorPuedeCancelarInscripcion,
} from './inscripciones-validacion';

/**
 * Spec de CARACTERIZACIÓN (red de seguridad del refactor de
 * public-inscripciones). Fija con golden values cada rama de las reglas de
 * categoría (género + nivel) extraídas verbatim del controller. Reglas de
 * negocio que antes no tenían ningún test.
 *
 * Convención de `orden`: menor orden = categoría SUPERIOR (1ra=alta, 8va=baja).
 */
const cat = (orden: number, nombre: string, tipo: 'MASCULINO' | 'FEMENINO') => ({ orden, nombre, tipo });

describe('validarReglasCategoria (caracterización)', () => {
  it('R1: hombre en categoría femenina -> rechazado', () => {
    expect(validarReglasCategoria('MASCULINO', cat(4, '4ta', 'MASCULINO'), cat(3, '3ra Damas', 'FEMENINO'), [])).toEqual({
      permitido: false,
      mensaje: 'Los jugadores masculinos no pueden inscribirse en categorías femeninas',
    });
  });

  it('R2: misma categoría -> permitido "de tu nivel"', () => {
    expect(validarReglasCategoria('MASCULINO', cat(4, '4ta', 'MASCULINO'), cat(4, '4ta', 'MASCULINO'), [])).toEqual({
      permitido: true,
      mensaje: 'Categoría de tu nivel',
      esCategoriaInferior: false,
    });
  });

  it('R2: categoría superior -> permitido "desafío aceptado"', () => {
    expect(validarReglasCategoria('MASCULINO', cat(4, '4ta', 'MASCULINO'), cat(3, '3ra', 'MASCULINO'), [])).toEqual({
      permitido: true,
      mensaje: 'Categoría superior - ¡Desafío aceptado!',
      esCategoriaInferior: false,
    });
  });

  it('R3: hombre bajando a inferior -> rechazado', () => {
    expect(validarReglasCategoria('MASCULINO', cat(4, '4ta', 'MASCULINO'), cat(5, '5ta', 'MASCULINO'), [])).toEqual({
      permitido: false,
      mensaje: 'No puedes inscribirte en 5ta siendo 4ta',
      esCategoriaInferior: true,
    });
  });

  it('mujer bajando en categorías de damas -> rechazado', () => {
    expect(validarReglasCategoria('FEMENINO', cat(4, '4ta Damas', 'FEMENINO'), cat(5, '5ta Damas', 'FEMENINO'), [])).toEqual({
      permitido: false,
      mensaje: 'No puedes inscribirte en 5ta Damas siendo 4ta Damas',
      esCategoriaInferior: true,
    });
  });

  it('mujer bajando más de una categoría en caballeros -> rechazado', () => {
    expect(validarReglasCategoria('FEMENINO', cat(4, '4ta', 'FEMENINO'), cat(6, '6ta Caballeros', 'MASCULINO'), [])).toEqual({
      permitido: false,
      mensaje: 'Solo puedes bajar UNA categoría como máximo. 6ta Caballeros es muy inferior a tu categoría actual.',
      esCategoriaInferior: true,
    });
  });

  it('mujer bajando exactamente una en caballeros -> permitido con advertencia', () => {
    expect(validarReglasCategoria('FEMENINO', cat(4, '4ta', 'FEMENINO'), cat(5, '5ta Caballeros', 'MASCULINO'), [])).toEqual({
      permitido: true,
      mensaje: 'Categoría permitida (excepción de una categoría inferior)',
      esCategoriaInferior: true,
      advertencia: 'Estás usando tu excepción de bajar una categoría en caballeros. Esta acción solo puede realizarse una vez.',
    });
  });
});

describe('validarCategoriaParaPareja (regla canónica única)', () => {
  // Catálogo: orden bajo = categoría alta. ids ficticios.
  const C = {
    cab4: { id: 'cab4', nombre: '4ta', tipo: 'MASCULINO', tipoCategoria: 'STANDARD', orden: 4 },
    cab5: { id: 'cab5', nombre: '5ta', tipo: 'MASCULINO', tipoCategoria: 'STANDARD', orden: 5 },
    dam4: { id: 'dam4', nombre: '4ta Damas', tipo: 'FEMENINO', tipoCategoria: 'STANDARD', orden: 4 },
  };
  const TODAS = Object.values(C);

  it('STANDARD: delega en validarReglasCategoria (hombre baja -> rechazado)', () => {
    const r = validarCategoriaParaPareja({
      jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' },
      categoriaTarget: C.cab5,
      todasCategorias: TODAS,
    });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toBe('No puedes inscribirte en 5ta siendo 4ta');
  });

  it('STANDARD: sin categoría asignada -> rechazado', () => {
    const r = validarCategoriaParaPareja({
      jugador: { genero: 'MASCULINO', categoriaActualId: null },
      categoriaTarget: C.cab4,
      todasCategorias: TODAS,
    });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toBe('Debes tener una categoría asignada para inscribirte a un torneo.');
  });

  it('STANDARD: jugador OK pero pareja superior bajando a inferior -> rechazado (valida ambos)', () => {
    // jugador 5ta en torneo 5ta = OK; pareja 4ta (superior) no puede BAJAR a 5ta.
    const r = validarCategoriaParaPareja({
      jugador: { genero: 'MASCULINO', categoriaActualId: 'cab5' },
      categoriaTarget: C.cab5,
      todasCategorias: TODAS,
      pareja: { genero: 'MASCULINO', categoriaActualId: 'cab4' },
    });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toContain('Tu pareja no puede inscribirse');
  });

  it('STANDARD: ambos elegibles -> permitido', () => {
    const r = validarCategoriaParaPareja({
      jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' },
      categoriaTarget: C.cab4,
      todasCategorias: TODAS,
      pareja: { genero: 'MASCULINO', categoriaActualId: 'cab4' },
    });
    expect(r.permitido).toBe(true);
  });

  it('STANDARD: pareja sin categoría -> rechazado', () => {
    const r = validarCategoriaParaPareja({
      jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' },
      categoriaTarget: C.cab4,
      todasCategorias: TODAS,
      pareja: { genero: 'MASCULINO', categoriaActualId: null },
    });
    expect(r.permitido).toBe(false);
    expect(r.mensaje).toBe('Tu pareja debe tener una categoría asignada para inscribirse.');
  });

  describe('MIXTO', () => {
    const mixta = { id: 'mx', nombre: 'Mixta A', tipo: 'MIXTO', tipoCategoria: 'MIXTO', orden: 1, reglas: { caballeroCategoriaId: 'cab4', damaCategoriaId: 'dam4' } };

    it('sin pareja -> difiere (permitido)', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: mixta, todasCategorias: TODAS, pareja: null });
      expect(r).toEqual({ permitido: true, mensaje: 'Se valida al elegir la pareja' });
    });

    it('mismo género -> rechazado', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: mixta, todasCategorias: TODAS, pareja: { genero: 'MASCULINO', categoriaActualId: 'cab4' } });
      expect(r).toEqual({ permitido: false, mensaje: 'En categoría mixta, la pareja debe ser de géneros opuestos' });
    });

    it('géneros opuestos y categorías correctas -> permitido', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: mixta, todasCategorias: TODAS, pareja: { genero: 'FEMENINO', categoriaActualId: 'dam4' } });
      expect(r.permitido).toBe(true);
    });

    it('categoría de la pareja no corresponde -> rechazado', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: mixta, todasCategorias: TODAS, pareja: { genero: 'FEMENINO', categoriaActualId: 'cab5' } });
      expect(r).toEqual({ permitido: false, mensaje: 'La categoría de tu pareja no corresponde a esta mixta' });
    });
  });

  describe('SUMAS', () => {
    const suma = { id: 'sm', nombre: 'Suma 9', tipo: 'MASCULINO', tipoCategoria: 'SUMAS', orden: 1, reglas: { sumaObjetivo: 9 } };

    it('sin pareja -> difiere (permitido)', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: suma, todasCategorias: TODAS, pareja: null });
      expect(r).toEqual({ permitido: true, mensaje: 'Se valida al elegir la pareja' });
    });

    it('distinto género -> rechazado', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: suma, todasCategorias: TODAS, pareja: { genero: 'FEMENINO', categoriaActualId: 'dam4' } });
      expect(r).toEqual({ permitido: false, mensaje: 'En categoría suma, ambos jugadores deben ser del mismo género' });
    });

    it('suma correcta (4+5=9) -> permitido', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: suma, todasCategorias: TODAS, pareja: { genero: 'MASCULINO', categoriaActualId: 'cab5' } });
      expect(r.permitido).toBe(true);
    });

    it('suma incorrecta -> rechazado con detalle', () => {
      const r = validarCategoriaParaPareja({ jugador: { genero: 'MASCULINO', categoriaActualId: 'cab4' }, categoriaTarget: suma, todasCategorias: TODAS, pareja: { genero: 'MASCULINO', categoriaActualId: 'cab4' } });
      expect(r.permitido).toBe(false);
      expect(r.mensaje).toContain('La suma de las categorías debe ser 9');
    });
  });
});

describe('cuadroYaArmado', () => {
  it('antes del sorteo (abiertas/cerradas/borrador) -> false', () => {
    expect(cuadroYaArmado('INSCRIPCIONES_ABIERTAS')).toBe(false);
    expect(cuadroYaArmado('INSCRIPCIONES_CERRADAS')).toBe(false);
    expect(cuadroYaArmado('FIXTURE_BORRADOR')).toBe(false);
  });

  it('desde el sorteo en adelante -> true', () => {
    expect(cuadroYaArmado('SORTEO_REALIZADO')).toBe(true);
    expect(cuadroYaArmado('EN_CURSO')).toBe(true);
    expect(cuadroYaArmado('FINALIZADA')).toBe(true);
  });

  it('null/undefined (sin categoría de torneo) -> false', () => {
    expect(cuadroYaArmado(null)).toBe(false);
    expect(cuadroYaArmado(undefined)).toBe(false);
  });
});

describe('jugadorPuedeCancelarInscripcion', () => {
  it('confirmada y antes del sorteo -> puede', () => {
    expect(
      jugadorPuedeCancelarInscripcion({ inscripcionEstado: 'CONFIRMADA', categoriaEstado: 'INSCRIPCIONES_CERRADAS' }),
    ).toBe(true);
  });

  it('confirmada pero ya sorteado -> NO puede (lo maneja el organizador)', () => {
    expect(
      jugadorPuedeCancelarInscripcion({ inscripcionEstado: 'CONFIRMADA', categoriaEstado: 'SORTEO_REALIZADO' }),
    ).toBe(false);
  });

  it('ya cancelada -> NO puede (aunque sea antes del sorteo)', () => {
    expect(
      jugadorPuedeCancelarInscripcion({ inscripcionEstado: 'CANCELADA', categoriaEstado: 'INSCRIPCIONES_ABIERTAS' }),
    ).toBe(false);
  });

  it('pendiente de pago y antes del sorteo -> puede', () => {
    expect(
      jugadorPuedeCancelarInscripcion({ inscripcionEstado: 'PENDIENTE_PAGO', categoriaEstado: null }),
    ).toBe(true);
  });
});
