import { api } from './api';

export interface RegistrarResultadoData {
  set1Pareja1: number;
  set1Pareja2: number;
  set2Pareja1: number;
  set2Pareja2: number;
  set3Pareja1?: number;
  set3Pareja2?: number;
  tiebreakSet3?: boolean;
  wo?: boolean;
  woPareja1?: boolean;
  woPareja2?: boolean;
  notas?: string;
}

export const matchService = {
  getById: (id: string) => api.get(`/matches/${id}`).then(r => r.data),
  registrarResultado: (id: string, data: RegistrarResultadoData) =>
    api.post(`/matches/${id}/resultado`, data).then(r => r.data),
  getByTournament: (tournamentId: string) =>
    api.get(`/matches/tournament/${tournamentId}`).then(r => r.data),
};
