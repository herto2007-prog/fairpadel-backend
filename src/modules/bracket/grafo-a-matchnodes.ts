/**
 * PUENTE (puro, sin DB): traduce el grafo del cuadro (`armarGrafo`) a la misma
 * forma que `generarBracket` devuelve hoy — `{ config, partidos: MatchNode[] }` —
 * para enchufarlo sin tocar `guardarBracket` ni el motor de resultados.
 *
 * El grafo ya trae los enlaces correctos (ganador → siguiente, perdedor →
 * siguiente, byes colapsados). Acá solo se mapean fases, orden, esBye, tipos de
 * entrada (cosméticos) y se reusan los ids del grafo como ids temporales.
 *
 * Verificado en grafo-a-matchnodes.spec.ts.
 */
import { FaseBracket, TipoEntrada, MatchNode, BracketConfigResponse } from './dto/generate-bracket.dto';
import { armarGrafo, NodoCuadro } from './cuadro-grafo';
import { PlanCuadro } from './cuadro-planner';

const FASE_MAP: Record<string, FaseBracket> = {
  ZONA: FaseBracket.ZONA,
  RONDA: FaseBracket.REPECHAJE,
  TREINTAYDOSAVOS: FaseBracket.TREINTAYDOSAVOS,
  DIECISEISAVOS: FaseBracket.DIECISEISAVOS,
  OCTAVOS: FaseBracket.OCTAVOS,
  CUARTOS: FaseBracket.CUARTOS,
  SEMIS: FaseBracket.SEMIS,
  FINAL: FaseBracket.FINAL,
};

// Orden canónico de fases para asignar `orden` y ordenar los partidos.
const ORDEN_FASE = ['ZONA', 'RONDA', 'TREINTAYDOSAVOS', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'];

/** Config informativa derivada del plan (misma forma que BracketConfigResponse). */
export function configDesdePlan(plan: PlanCuadro): BracketConfigResponse {
  const ganadoresZona = plan.zonaPartidos + (plan.zonaBye ? 1 : 0);
  const fases: FaseBracket[] = [FaseBracket.ZONA];
  if (plan.rondaPartidos > 0) fases.push(FaseBracket.REPECHAJE);
  for (const f of plan.fasesLlave) fases.push(FASE_MAP[f.fase]);
  return {
    totalParejas: plan.parejas,
    tamanoBracket: plan.llave,
    parejasConBye: plan.zonaBye ? 1 : 0,
    partidosZona: plan.zonaPartidos,
    parejasEnRepechaje: plan.rondaPartidos * 2,
    partidosRepechaje: plan.rondaPartidos,
    ganadoresZona,
    ganadoresRepechaje: plan.rondaGrupos.length,
    perdedoresDirectos: 0,
    fases,
  };
}

/** Tipo de entrada (cosmético) de una posición, según de dónde viene su origen. */
function tipoDeOrigen(n: NodoCuadro, pos: 1 | 2, idx: Map<string, NodoCuadro>): TipoEntrada | undefined {
  const oid = pos === 1 ? n.origen1Id : n.origen2Id;
  const esPerd = pos === 1 ? n.origen1EsPerdedor : n.origen2EsPerdedor;
  if (!oid) return undefined;
  const origen = idx.get(oid);
  if (!origen) return undefined;
  if (origen.fase === 'ZONA') return esPerd ? TipoEntrada.PERDEDOR_ZONA : TipoEntrada.GANADOR_ZONA;
  if (origen.fase === 'RONDA') return TipoEntrada.GANADOR_REPECHAJE;
  return undefined; // viene de otro partido de llave → avance interno (sin etiqueta)
}

export function grafoAMatchNodes(parejas: number): {
  config: BracketConfigResponse;
  partidos: MatchNode[];
} {
  const { plan, nodos } = armarGrafo(parejas);
  const config = configDesdePlan(plan);
  const idx = new Map(nodos.map((n) => [n.id, n]));

  // Orden estable: por fase canónica; dentro de ZONA el bye va último (para que
  // `guardarBracket` le asigne la última inscripción impar).
  const ordenados = [...nodos].sort((a, b) => {
    const fa = ORDEN_FASE.indexOf(a.fase);
    const fb = ORDEN_FASE.indexOf(b.fase);
    if (fa !== fb) return fa - fb;
    if (a.id === 'Z-BYE') return 1;
    if (b.id === 'Z-BYE') return -1;
    return a.id < b.id ? -1 : 1;
  });

  const seqPorFase = new Map<string, number>();
  const siguienteOrden = (faseKey: string) => {
    const n = (seqPorFase.get(faseKey) || 0) + 1;
    seqPorFase.set(faseKey, n);
    return n;
  };

  const partidos: MatchNode[] = ordenados.map((n) => {
    const m: MatchNode = {
      id: n.id,
      fase: FASE_MAP[n.fase],
      orden: siguienteOrden(n.fase),
      esBye: !!n.esBye,
    };
    if (n.siguienteId) {
      m.partidoSiguienteId = n.siguienteId;
      m.posicionEnSiguiente = n.posEnSiguiente;
    }
    if (n.perdedorSiguienteId) {
      m.partidoPerdedorSiguienteId = n.perdedorSiguienteId;
      m.posicionEnPerdedor = n.posPerdedorEnSiguiente;
    }
    if (n.origen1Id) m.partidoOrigen1Id = n.origen1Id;
    if (n.origen2Id) m.partidoOrigen2Id = n.origen2Id;

    if (n.fase === 'ZONA') {
      m.tipoEntrada1 = TipoEntrada.INSCRIPCION;
      if (!n.esBye) m.tipoEntrada2 = TipoEntrada.INSCRIPCION;
    } else {
      m.tipoEntrada1 = tipoDeOrigen(n, 1, idx);
      m.tipoEntrada2 = tipoDeOrigen(n, 2, idx);
    }
    return m;
  });

  return { config, partidos };
}
