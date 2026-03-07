import { api } from './api';

export interface FixtureVersion {
  id: string;
  tournamentId: string;
  categoryId: string;
  version: number;
  definicion: any;
  estado: 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';
  matches: Match[];
}

export interface Match {
  id: string;
  ronda: 'ACOMODACION_1' | 'ACOMODACION_2' | 'OCTAVOS' | 'CUARTOS' | 'SEMIS' | 'FINAL';
  estado: 'PROGRAMADO' | 'EN_JUEGO' | 'FINALIZADO' | 'WO';
  pareja1?: any;
  pareja2?: any;
  set1Pareja1?: number;
  set1Pareja2?: number;
  set2Pareja1?: number;
  set2Pareja2?: number;
  set3Pareja1?: number;
  set3Pareja2?: number;
}

export const fixtureService = {
  getByTournamentAndCategory: (tournamentId: string, categoryId: string) =>
    api.get(`/fixture/tournament/${tournamentId}/category/${categoryId}`).then(r => r.data),
  generar: (tournamentId: string, categoryId: string) =>
    api.post(`/fixture/generar`, { tournamentId, categoryId }).then(r => r.data),
  publicar: (fixtureVersionId: string) =>
    api.post(`/fixture/${fixtureVersionId}/publicar`).then(r => r.data),
};
