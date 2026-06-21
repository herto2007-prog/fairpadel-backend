import { Gender, CategoriaEstado, InscripcionEstado } from '@prisma/client';

/**
 * Estados de la categoría del torneo (TournamentCategory) en los que el cuadro
 * YA está sorteado: cancelar una inscripción dejaría un hueco en el bracket.
 */
export const ESTADOS_CON_CUADRO_ARMADO: CategoriaEstado[] = [
  CategoriaEstado.SORTEO_REALIZADO,
  CategoriaEstado.EN_CURSO,
  CategoriaEstado.FINALIZADA,
];

/** ¿La categoría del torneo ya tiene el cuadro sorteado? */
export function cuadroYaArmado(categoriaEstado: CategoriaEstado | null | undefined): boolean {
  return categoriaEstado != null && ESTADOS_CON_CUADRO_ARMADO.includes(categoriaEstado);
}

/**
 * ¿Puede el JUGADOR (jugador 1) auto-cancelar su inscripción desde app/web?
 *
 * Regla: solo ANTES de que se arme el cuadro de la categoría, y mientras no
 * esté ya cancelada. Una vez sorteado, debe pedirlo al organizador (que sí
 * puede bajarlo vía WO/retiro sin romper el bracket).
 *
 * FUENTE ÚNICA: la usan el backend (guard en cancelar) y el flag `puedeCancelar`
 * de GET /inscripciones/my. El front NO replica esta lógica: refleja el flag.
 */
export function jugadorPuedeCancelarInscripcion(params: {
  inscripcionEstado: InscripcionEstado;
  categoriaEstado: CategoriaEstado | null | undefined;
}): boolean {
  if (params.inscripcionEstado === InscripcionEstado.CANCELADA) return false;
  return !cuadroYaArmado(params.categoriaEstado);
}

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

export interface JugadorRef {
  genero: Gender;
  categoriaActualId: string | null;
}

/**
 * REGLA ÚNICA Y CANÓNICA de elegibilidad de categoría (STANDARD + MIXTO + SUMAS).
 *
 * La usan el endpoint de creación de inscripción (POST /inscripciones/public) Y el
 * endpoint de consulta del wizard (categorias-permitidas) → una sola fuente de verdad.
 * El front NO replica esta lógica: consulta el endpoint y pinta `permitido`/`mensaje`.
 *
 * - STANDARD: depende solo del jugador (reusa validarReglasCategoria).
 * - MIXTO/SUMAS: dependen de la pareja + config de la categoría (`reglas`). Si no se
 *   pasa `pareja` (todavía no elegida / no registrada), se DIFIERE (permitido=true)
 *   porque no se puede decidir sin esos datos; igual el create valida al confirmar.
 */
export function validarCategoriaParaPareja(params: {
  jugador: JugadorRef;
  categoriaTarget: any; // category: { id, nombre, tipo, tipoCategoria, orden, reglas }
  todasCategorias: any[];
  pareja?: JugadorRef | null;
}): { permitido: boolean; mensaje: string; advertencia?: string } {
  const { jugador, categoriaTarget, todasCategorias, pareja } = params;
  const tipo = categoriaTarget.tipoCategoria;

  if (tipo === 'MIXTO') {
    if (!pareja) return { permitido: true, mensaje: 'Se valida al elegir la pareja' };
    const reglas = categoriaTarget.reglas as { damaCategoriaId: string; caballeroCategoriaId: string };
    if (jugador.genero === pareja.genero) {
      return { permitido: false, mensaje: 'En categoría mixta, la pareja debe ser de géneros opuestos' };
    }
    if (!pareja.categoriaActualId) {
      return { permitido: false, mensaje: 'Tu pareja debe tener una categoría asignada' };
    }
    if (jugador.genero === 'MASCULINO') {
      if (jugador.categoriaActualId !== reglas.caballeroCategoriaId) return { permitido: false, mensaje: 'Tu categoría no corresponde a esta mixta' };
      if (pareja.categoriaActualId !== reglas.damaCategoriaId) return { permitido: false, mensaje: 'La categoría de tu pareja no corresponde a esta mixta' };
    } else {
      if (jugador.categoriaActualId !== reglas.damaCategoriaId) return { permitido: false, mensaje: 'Tu categoría no corresponde a esta mixta' };
      if (pareja.categoriaActualId !== reglas.caballeroCategoriaId) return { permitido: false, mensaje: 'La categoría de tu pareja no corresponde a esta mixta' };
    }
    return { permitido: true, mensaje: 'Pareja mixta válida' };
  }

  if (tipo === 'SUMAS') {
    if (!pareja) return { permitido: true, mensaje: 'Se valida al elegir la pareja' };
    const reglas = categoriaTarget.reglas as { sumaObjetivo: number };
    if (jugador.genero !== pareja.genero) {
      return { permitido: false, mensaje: 'En categoría suma, ambos jugadores deben ser del mismo género' };
    }
    if (!pareja.categoriaActualId) {
      return { permitido: false, mensaje: 'Tu pareja debe tener una categoría asignada' };
    }
    const catJ1 = todasCategorias.find((c) => c.id === jugador.categoriaActualId);
    const catJ2 = todasCategorias.find((c) => c.id === pareja.categoriaActualId);
    if (!catJ1 || !catJ2) {
      return { permitido: false, mensaje: 'Categoría no válida para uno de los jugadores' };
    }
    if (catJ1.orden + catJ2.orden !== reglas.sumaObjetivo) {
      return {
        permitido: false,
        mensaje: `La suma de las categorías debe ser ${reglas.sumaObjetivo}. ` +
          `Tu categoría (${catJ1.orden}) + categoría de tu pareja (${catJ2.orden}) = ${catJ1.orden + catJ2.orden}`,
      };
    }
    return { permitido: true, mensaje: 'Suma válida' };
  }

  // STANDARD (default)
  if (!jugador.categoriaActualId) {
    return { permitido: false, mensaje: 'Debes tener una categoría asignada para inscribirte a un torneo.' };
  }
  const categoriaJugador = todasCategorias.find((c) => c.id === jugador.categoriaActualId);
  if (!categoriaJugador) {
    return { permitido: false, mensaje: 'Tu categoría asignada no es válida. Contacta al administrador.' };
  }
  const v = validarReglasCategoria(jugador.genero, categoriaJugador, categoriaTarget, todasCategorias);
  if (!v.permitido) {
    return { permitido: v.permitido, mensaje: v.mensaje, advertencia: v.advertencia };
  }

  // La pareja (si está elegida y registrada) también debe cumplir la regla.
  // En STANDARD AMBOS jugadores deben ser elegibles en la categoría destino.
  if (pareja) {
    if (!pareja.categoriaActualId) {
      return { permitido: false, mensaje: 'Tu pareja debe tener una categoría asignada para inscribirse.' };
    }
    const categoriaPareja = todasCategorias.find((c) => c.id === pareja.categoriaActualId);
    if (!categoriaPareja) {
      return { permitido: false, mensaje: 'La categoría de tu pareja no es válida.' };
    }
    const vp = validarReglasCategoria(pareja.genero, categoriaPareja, categoriaTarget, todasCategorias);
    if (!vp.permitido) {
      return { permitido: false, mensaje: `Tu pareja no puede inscribirse en esta categoría: ${vp.mensaje}` };
    }
  }

  return { permitido: v.permitido, mensaje: v.mensaje, advertencia: v.advertencia };
}
