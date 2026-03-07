import { api } from './api';

export interface Instructor {
  id: string;
  experienciaAnios: number;
  especialidades?: string;
  precioIndividual?: number;
  precioGrupal?: number;
  user: { nombre: string; apellido: string; fotoUrl?: string };
  ubicaciones: any[];
}

export const instructoresService = {
  getAll: (ciudad?: string) => api.get('/instructores', { params: { ciudad } }).then(r => r.data),
  getById: (id: string) => api.get(`/instructores/${id}`).then(r => r.data),
  
  crearSolicitud: (data: any) => api.post('/instructores/solicitudes', data).then(r => r.data),
  getMisSolicitudes: () => api.get('/instructores/solicitudes/my').then(r => r.data),
  
  crearReserva: (data: any) => api.post('/instructores/reservas', data).then(r => r.data),
  getMisReservas: () => api.get('/instructores/reservas/my').then(r => r.data),
  
  getMiPerfil: () => api.get('/instructores/panel/mi-perfil').then(r => r.data),
  actualizarPerfil: (data: any) => api.patch('/instructores/panel/mi-perfil', data).then(r => r.data),
  confirmarReserva: (id: string, data: any) =>
    api.post(`/instructores/reservas/${id}/confirmar`, data).then(r => r.data),
  cancelarReserva: (id: string, data: any) =>
    api.post(`/instructores/reservas/${id}/cancelar`, data).then(r => r.data),
  completarReserva: (id: string, asistio: boolean) =>
    api.post(`/instructores/reservas/${id}/completar`, { asistio }).then(r => r.data),
  
  registrarPago: (data: any) => api.post('/instructores/pagos', data).then(r => r.data),
  getMisPagos: () => api.get('/instructores/pagos/my').then(r => r.data),
};
