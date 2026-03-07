import { api } from './api';

export interface Ranking {
  id: string;
  jugadorId: string;
  tipoRanking: string;
  puntosTotales: number;
  torneosJugados: number;
  partidosGanados: number;
  partidosPerdidos: number;
  jugador: {
    nombre: string;
    apellido: string;
    fotoUrl?: string;
  };
}

export const rankingsService = {
  getGlobal: () => api.get('/rankings/global').then(r => r.data),
  getByCategoria: (categoriaId: string) => api.get(`/rankings/categoria/${categoriaId}`).then(r => r.data),
  getByJugador: (jugadorId: string) => api.get(`/rankings/jugador/${jugadorId}`).then(r => r.data),
  recalcular: () => api.post('/rankings/recalcular').then(r => r.data),
};
