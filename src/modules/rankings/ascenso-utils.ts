/**
 * Motor PURO de detección de candidatos a ascenso (Capa 1 — FairPadel regulador).
 *
 * Antes, los candidatos se detectaban leyendo `historial_puntos`, que SOLO se
 * escribe para torneos dentro de un circuito aprobado. Resultado: el campeón de
 * un torneo independiente nunca aparecía como candidato a ascenso.
 *
 * Acá la detección trabaja sobre los RESULTADOS REALES de torneos (campeón /
 * finalista de cualquier torneo finalizado), desacoplada por completo de los
 * circuitos. El servicio junta los datos de la BD y llama a estas funciones.
 *
 * Funciones puras → testeables sin BD.
 */

export type PosicionResultado = 'CAMPEON' | 'FINALISTA';

export interface ResultadoTorneo {
  jugadorId: string;
  categoryId: string; // categoría (global) del torneo donde logró el resultado
  tournamentId: string;
  fecha: string; // YYYY-MM-DD (fecha de inicio del torneo)
  posicion: PosicionResultado;
}

export interface ReglaAscensoInput {
  id: string;
  categoriaOrigenId: string;
  categoriaDestinoId: string;
  campeonatosRequeridos: number;
  mesesVentana: number;
  finalistaCalifica: boolean;
}

export interface CandidatoAscenso {
  reglaId: string;
  jugadorId: string;
  categoriaOrigenId: string;
  categoriaDestinoId: string;
  torneosGanados: string[]; // tournamentIds que cuentan para la regla
}

/**
 * Resta `meses` a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD.
 * Usa aritmética UTC (determinista, sin desfase de zona horaria).
 */
export function restarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() - meses);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Dado el conjunto de reglas activas y los resultados reales de torneos,
 * devuelve los candidatos a ascenso (jugadores que cumplen alguna regla).
 *
 * Reglas honradas: ventana temporal (mesesVentana), categoría origen,
 * campeonatos requeridos, y `finalistaCalifica` (si la regla lo permite, ser
 * finalista también suma para el conteo).
 *
 * NOTA: `minimoTorneosJugados` y `tipoConteo` (CONSECUTIVOS) NO se aplican aún
 * (en producción todas las reglas usan minimo=0 y ALTERNADOS). Se documenta
 * como deuda explícita para no introducir comportamiento no probado.
 */
export function detectarCandidatosAscenso(
  reglas: ReglaAscensoInput[],
  resultados: ResultadoTorneo[],
  hoy: string,
): CandidatoAscenso[] {
  const candidatos: CandidatoAscenso[] = [];

  for (const regla of reglas) {
    const fechaDesde = restarMeses(hoy, regla.mesesVentana);

    // Resultados que cuentan para ESTA regla: misma categoría origen, dentro de
    // la ventana, y que sean campeonatos (o finalista si la regla lo permite).
    const relevantes = resultados.filter(
      (r) =>
        r.categoryId === regla.categoriaOrigenId &&
        r.fecha >= fechaDesde &&
        (r.posicion === 'CAMPEON' ||
          (regla.finalistaCalifica && r.posicion === 'FINALISTA')),
    );

    // Agrupar por jugador → set de torneos que cuentan (distintos).
    const porJugador = new Map<string, Set<string>>();
    for (const r of relevantes) {
      const set = porJugador.get(r.jugadorId) ?? new Set<string>();
      set.add(r.tournamentId);
      porJugador.set(r.jugadorId, set);
    }

    for (const [jugadorId, torneos] of porJugador) {
      if (torneos.size >= regla.campeonatosRequeridos) {
        candidatos.push({
          reglaId: regla.id,
          jugadorId,
          categoriaOrigenId: regla.categoriaOrigenId,
          categoriaDestinoId: regla.categoriaDestinoId,
          torneosGanados: [...torneos],
        });
      }
    }
  }

  return candidatos;
}
