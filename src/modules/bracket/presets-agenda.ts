/**
 * PRESETS DE AGENDA (puro, sin DB) — el "paquete predeterminado".
 *
 * Dado un FORMATO y las fechas de juego, decide para cada día su ventana horaria
 * y qué fases admite (`fasesPermitidas`). Es el default inteligente que reemplaza
 * a la regla fija por día-de-semana (`obtenerFasesParaDia`, que asume finde).
 *
 * El organizador elige el formato; el sistema autogenera los días. Después puede
 * editar cada día a mano (la UI ya lo permite). El asignador (Fase 1) respeta lo
 * que esto escriba.
 *
 * Puro y determinístico → verificado en presets-agenda.spec.ts.
 */

export type FormatoTorneo = 'FINDE' | 'EXPRESS' | 'LIGA' | 'NOCTURNO';

export interface DiaPreset {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  minutosSlot: number;
  fasesPermitidas: string[];
}

// Grupos de fases (en orden de cuadro). La llave lista TODAS las fases posibles:
// si el cuadro es chico, las grandes simplemente no tienen partidos (inofensivo).
const ZONA_REP = ['ZONA', 'REPECHAJE'];
const LLAVE = ['TREINTAYDOSAVOS', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS'];
const FINALES = ['SEMIS', 'FINAL'];
const TODAS = [...ZONA_REP, ...LLAVE, ...FINALES];

const MINUTOS_SLOT_DEFAULT = 90;

function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=dom … 6=sáb
}
const esFinde = (fecha: string) => [0, 6].includes(diaSemana(fecha));

/**
 * Reparte las fases en orden de cuadro sobre los días ordenados: los primeros
 * días = ZONA/REPECHAJE, el último = FINALES, el medio = la llave. Sirve para
 * formatos secuenciales (nocturno, liga) y para cualquier set de fechas.
 */
function distribuirSecuencial(fechas: string[]): string[][] {
  const n = fechas.length;
  if (n === 0) return [];
  if (n === 1) return [TODAS];
  if (n === 2) return [[...ZONA_REP, ...LLAVE], FINALES];
  // n >= 3: primer tercio ZONA_REP, último día FINALES, el resto LLAVE.
  const out: string[][] = [];
  const corteZona = Math.max(1, Math.round(n / 3)); // cuántos días de zona
  for (let i = 0; i < n; i++) {
    if (i < corteZona) out.push([...ZONA_REP]);
    else if (i === n - 1) out.push([...FINALES]);
    else out.push([...LLAVE]);
  }
  return out;
}

/** Ventana horaria por defecto de un día, según formato y si es finde. */
function ventana(formato: FormatoTorneo, fecha: string): { horaInicio: string; horaFin: string } {
  switch (formato) {
    case 'EXPRESS':
      return { horaInicio: '09:00', horaFin: '22:00' };
    case 'NOCTURNO':
      return { horaInicio: '18:00', horaFin: '23:00' };
    case 'LIGA':
      return esFinde(fecha) ? { horaInicio: '14:00', horaFin: '23:00' } : { horaInicio: '18:00', horaFin: '23:00' };
    case 'FINDE':
    default:
      return esFinde(fecha) ? { horaInicio: '14:00', horaFin: '23:00' } : { horaInicio: '18:00', horaFin: '23:00' };
  }
}

/**
 * Genera el plan de días para un formato. `fechas` se ordena internamente.
 */
export function planDiasPorFormato(
  formato: FormatoTorneo,
  fechas: string[],
  minutosSlot: number = MINUTOS_SLOT_DEFAULT,
): DiaPreset[] {
  const dias = [...new Set(fechas)].sort();
  if (dias.length === 0) return [];

  // Qué fases por día según el formato.
  let fasesPorDia: string[][];
  if (formato === 'EXPRESS') {
    // Todo en cada día (normalmente uno solo).
    fasesPorDia = dias.map(() => [...TODAS]);
  } else if (formato === 'FINDE') {
    // Mapeo clásico por día de semana; si el día no es jue–dom, cae a "solo zona".
    fasesPorDia = dias.map((f) => {
      const dow = diaSemana(f);
      if (dow === 4 || dow === 5) return [...ZONA_REP];      // jue/vie
      if (dow === 6) return [...LLAVE];                      // sáb
      if (dow === 0) return [...FINALES];                    // dom
      return ['ZONA'];
    });
    // Si por las fechas elegidas no quedó ningún día de FINALES, cae a secuencial
    // (evita finales sin día → partidos sin programar).
    if (!fasesPorDia.some((fs) => fs.includes('FINAL'))) {
      fasesPorDia = distribuirSecuencial(dias);
    }
  } else {
    // LIGA / NOCTURNO: secuencial sobre los días.
    fasesPorDia = distribuirSecuencial(dias);
  }

  return dias.map((fecha, i) => ({
    fecha,
    ...ventana(formato, fecha),
    minutosSlot,
    fasesPermitidas: fasesPorDia[i],
  }));
}
