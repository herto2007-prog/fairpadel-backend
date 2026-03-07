import { api } from './api';

export interface Inscripcion {
  id: string;
  tournamentId: string;
  categoryId: string;
  jugador1Id: string;
  jugador2Id?: string;
  estado: 'PENDIENTE_PAGO' | 'PENDIENTE_CONFIRMACION' | 'CONFIRMADA' | 'CANCELADA';
  modalidad: string;
}

export const inscripcionService = {
  getAll: () => api.get('/inscripciones').then(r => r.data),
  getById: (id: string) => api.get(`/inscripciones/${id}`).then(r => r.data),
  getByTournament: (tournamentId: string) => api.get(`/inscripciones/tournament/${tournamentId}`).then(r => r.data),
  getMyInscripciones: () => api.get('/inscripciones/my').then(r => r.data),
  create: (data: any) => api.post('/inscripciones', data).then(r => r.data),
  confirmar: (id: string) => api.post(`/inscripciones/${id}/confirmar`).then(r => r.data),
  cancelar: (id: string) => api.post(`/inscripciones/${id}/cancelar`).then(r => r.data),
};
