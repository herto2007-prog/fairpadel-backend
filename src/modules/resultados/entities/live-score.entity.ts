// Estructura del marcador en vivo almacenado en JSON

export interface LiveScore {
  setActual: number; // 1, 2, o 3
  gameP1: number;
  gameP2: number;
  puntoP1: number | string; // 0, 15, 30, 40, 'AD' o número para tie-break
  puntoP2: number | string;
  saque: number; // 1 o 2 - quién saca
  historial: HistorialPunto[];
  setsCompletados: SetCompletado[];
  estado: 'EN_JUEGO' | 'SET_POINT' | 'MATCH_POINT' | 'TIE_BREAK' | 'SUPER_TIE_BREAK' | 'FINALIZADO';
  iniciadoAt: string; // ISO string
}

export interface HistorialPunto {
  id: string;
  set: number;
  game: number;
  tipo: 'PUNTO' | 'FALTA_DIRECTA' | 'ACE' | 'DOBLE_FALTA';
  ganador: number; // 1 o 2
  detalle?: string;
  timestamp: string;
  marcadorAntes: {
    gameP1: number;
    gameP2: number;
    puntoP1: number | string;
    puntoP2: number | string;
  };
}

export interface SetCompletado {
  numero: number;
  gamesP1: number;
  gamesP2: number;
  tieBreakP1?: number;
  tieBreakP2?: number;
  ganador: number; // 1 o 2
}

// Valores de puntos en tenis/pádel
export const VALORES_PUNTOS = [0, 15, 30, 40, 'AD'] as const;

// Máximo de games para ganar un set (con diferencia de 2)
export const GAMES_PARA_SET = 6;

// Puntos para ganar tie-break
export const PUNTOS_TIE_BREAK = 7;

// Puntos para ganar súper tie-break
export const PUNTOS_SUPER_TIE_BREAK = 10;
