import { validarReglasCategoria } from './inscripciones-validacion';

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
