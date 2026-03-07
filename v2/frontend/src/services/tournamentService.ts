import { api } from './api';

export interface Tournament {
  id: string;
  nombre: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin: string;
  fechaLimiteInscripcion: string;
  costoInscripcion: number;
  estado: string;
  ciudad: string;
  sede?: {
    id: string;
    nombre: string;
  };
  organizador?: {
    id: string;
    nombre: string;
    apellido: string;
  };
  categorias?: {
    id: string;
    category: {
      id: string;
      nombre: string;
      tipo: string;
    };
  }[];
}

export const tournamentService = {
  getAll: () => api.get('/tournaments').then(r => r.data),
  getById: (id: string) => api.get(`/tournaments/${id}`).then(r => r.data),
  create: (data: any) => api.post('/tournaments', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/tournaments/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/tournaments/${id}`).then(r => r.data),
};
