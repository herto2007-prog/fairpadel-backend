import { Gender } from '@prisma/client';

/**
 * Reglas puras de validación de inscripción.
 *
 * Extraídas VERBATIM desde public-inscripciones.controller.ts (corte 1 del
 * refactor de deuda técnica). No tocan la base de datos: deciden si un jugador
 * puede inscribirse en una categoría según género y nivel. Cubiertas por
 * inscripciones-validacion.spec.ts (caracterización con golden values).
 */

/**
 * Valida las reglas de categoría según género y nivel
 */
export function validarReglasCategoria(
  jugadorGenero: Gender,
  categoriaJugador: any,
  categoriaTarget: any,
  todasCategorias: any[],
): { permitido: boolean; mensaje: string; esCategoriaInferior?: boolean; advertencia?: string } {
  const ordenJugador = categoriaJugador.orden;
  const ordenTarget = categoriaTarget.orden;
  const esTargetDamas = categoriaTarget.tipo === 'FEMENINO';
  const esTargetCaballeros = categoriaTarget.tipo === 'MASCULINO';

  // REGLA 1: Hombres NO pueden en categorías Damas
  if (jugadorGenero === 'MASCULINO' && esTargetDamas) {
    return {
      permitido: false,
      mensaje: 'Los jugadores masculinos no pueden inscribirse en categorías femeninas',
    };
  }

  // REGLA 2: Categoría igual o superior - permitida para todos
  if (ordenTarget <= ordenJugador) {
    return {
      permitido: true,
      mensaje: ordenTarget === ordenJugador
        ? 'Categoría de tu nivel'
        : 'Categoría superior - ¡Desafío aceptado!',
      esCategoriaInferior: false,
    };
  }

  // REGLA 3: Categorías INFERIORES (ordenTarget > ordenJugador)
  // Hombres: NO pueden bajar a inferiores (bajo ninguna circunstancia)
  if (jugadorGenero === 'MASCULINO') {
    return {
      permitido: false,
      mensaje: `No puedes inscribirte en ${categoriaTarget.nombre} siendo ${categoriaJugador.nombre}`,
      esCategoriaInferior: true,
    };
  }

  // Mujeres en categorías Damas (su género): NO pueden bajar
  if (esTargetDamas) {
    return {
      permitido: false,
      mensaje: `No puedes inscribirte en ${categoriaTarget.nombre} siendo ${categoriaJugador.nombre}`,
      esCategoriaInferior: true,
    };
  }

  // Mujeres en categorías Caballeros: SÍ pueden bajar UNA como excepción
  const diferencia = ordenTarget - ordenJugador;
  if (diferencia > 1) {
    return {
      permitido: false,
      mensaje: `Solo puedes bajar UNA categoría como máximo. ${categoriaTarget.nombre} es muy inferior a tu categoría actual.`,
      esCategoriaInferior: true,
    };
  }

  return {
    permitido: true,
    mensaje: 'Categoría permitida (excepción de una categoría inferior)',
    esCategoriaInferior: true,
    advertencia: 'Estás usando tu excepción de bajar una categoría en caballeros. Esta acción solo puede realizarse una vez.',
  };
}
