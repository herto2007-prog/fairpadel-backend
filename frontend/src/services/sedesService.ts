import { api } from './api';

export interface Sede {
  id: string;
  nombre: string;
  ciudad: string;
  direccion?: string;
  mapsUrl?: string;
  telefono?: string;
  activa: boolean;
  canchas?: Cancha[];
}

export interface Cancha {
  id: string;
  nombre: string;
  tipo: 'CRISTAL' | 'SINTETICO' | 'CEMENTO';
  tieneLuz: boolean;
  cubierta: boolean;
  activa: boolean;
}

export const sedesService = {
  getAll: (ciudad?: string) => api.get('/sedes', { params: { ciudad } }).then(r => r.data),
  getById: (id: string) => api.get(`/sedes/${id}`).then(r => r.data),
  create: (data: any) => api.post('/sedes', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/sedes/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/sedes/${id}`).then(r => r.data),
  getCanchas: (sedeId: string) => api.get(`/sedes/${sedeId}/canchas`).then(r => r.data),
};
