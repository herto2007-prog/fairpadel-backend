/**
 * Motor PURO de "puesto en el cuadro → puntos" (Circuitos, Corte 1).
 *
 * Antes, las posiciones solo cubrían FINAL/SEMIS/CUARTOS/OCTAVOS: en cuadros
 * grandes (32 y 64 parejas) los que perdían en 16avos/32avos quedaban en CERO.
 * Acá la asignación de puestos es EXHAUSTIVA y vive en una función pura,
 * testeable sin BD. El servicio junta los partidos y delega acá.
 */

export interface InscripcionLado {
  jugador1Id: string | null;
  jugador2Id: string | null;
}

export interface PartidoCuadro {
  ronda: string; // ZONA, REPECHAJE, TREINTAYDOSAVOS, DIECISEISAVOS, OCTAVOS, CUARTOS, SEMIS, FINAL
  ganadora: InscripcionLado | null;
  perdedora: InscripcionLado | null;
}

export interface PuestoJugadores {
  posicion: string; // '1ro', '2do', '3ro-4to', ...
  jugadoresIds: string[];
}

/**
 * Puesto del PERDEDOR de cada ronda eliminatoria. El GANADOR de la FINAL es 1ro.
 * Cubre todos los tamaños de cuadro. ZONA/REPECHAJE no otorgan puesto (no son
 * eliminatoria del bracket principal; sus perdedores que no avanzan no puntúan).
 */
export const PERDEDOR_PUESTO: Record<string, string> = {
  FINAL: '2do',
  SEMIS: '3ro-4to',
  CUARTOS: '5to-8vo',
  OCTAVOS: '9no-16to',
  DIECISEISAVOS: '17mo-32do',
  TREINTAYDOSAVOS: '33avo-64to',
};

// Orden para recorrer las rondas de perdedores (de la más profunda a la más temprana).
const RONDAS_PERDEDOR = ['FINAL', 'SEMIS', 'CUARTOS', 'OCTAVOS', 'DIECISEISAVOS', 'TREINTAYDOSAVOS'];

function ladoIds(lado: InscripcionLado | null | undefined): string[] {
  if (!lado) return [];
  return [lado.jugador1Id, lado.jugador2Id].filter((x): x is string => !!x);
}

/**
 * Dado el conjunto de partidos FINALIZADOS de una categoría, devuelve el puesto
 * de cada pareja: campeón (ganador de la final), y los perdedores de cada ronda.
 */
export function calcularPuestosDelCuadro(partidos: PartidoCuadro[]): PuestoJugadores[] {
  const resultados: PuestoJugadores[] = [];

  const final = partidos.find((p) => p.ronda === 'FINAL');
  if (final?.ganadora) {
    resultados.push({ posicion: '1ro', jugadoresIds: ladoIds(final.ganadora) });
  }

  for (const ronda of RONDAS_PERDEDOR) {
    const puesto = PERDEDOR_PUESTO[ronda];
    for (const p of partidos.filter((x) => x.ronda === ronda)) {
      const ids = ladoIds(p.perdedora);
      if (ids.length > 0) {
        resultados.push({ posicion: puesto, jugadoresIds: ids });
      }
    }
  }

  return resultados;
}

/**
 * Encuentra la configuración de puntos para un puesto. Coincidencia exacta
 * primero; si no, cae en el rango correspondiente. '33avo-64to' no tiene
 * config propia → cae a 'participacion' (si existe).
 */
export function encontrarConfigParaPosicion<T extends { posicion: string }>(
  configs: T[],
  posicion: string,
): T | undefined {
  const exacta = configs.find((c) => c.posicion === posicion);
  if (exacta) return exacta;

  if (posicion.startsWith('3ro') || posicion.startsWith('4to')) {
    return configs.find((c) => c.posicion === '3ro-4to');
  }
  if (['5to', '6to', '7mo', '8vo'].some((p) => posicion.startsWith(p))) {
    return configs.find((c) => c.posicion === '5to-8vo');
  }
  if (['9no', '10mo', '11vo', '12do', '13ro', '14to', '15to', '16to'].some((p) => posicion.startsWith(p))) {
    return configs.find((c) => c.posicion === '9no-16to');
  }
  if (posicion.startsWith('17') || posicion.startsWith('17mo')) {
    return configs.find((c) => c.posicion === '17mo-32do');
  }
  if (posicion.startsWith('33')) {
    return configs.find((c) => c.posicion === 'participacion');
  }
  return undefined;
}
