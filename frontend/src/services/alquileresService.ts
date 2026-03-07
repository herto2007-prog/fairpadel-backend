import { api } from './api';

export interface Reserva {
  id: string;
  sedeCanchaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precio: number;
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA';
  sedeCancha?: { nombre: string; sede: { nombre: string } };
}

export const alquileresService = {
  getDisponibilidad: (sedeId: string, fecha: string, canchaId?: string) =>
    api.get('/alquileres/disponibilidad', { params: { sedeId, fecha, canchaId } }).then(r => r.data),
  
  crearReserva: (data: any) => api.post('/alquileres/reservas', data).then(r => r.data),
  
  getMisReservas: () => api.get('/alquileres/mis-reservas').then(r => r.data),
  
  confirmarReserva: (id: string, data: any) =>
    api.post(`/alquileres/reservas/${id}/confirmar`, data).then(r => r.data),
  
  cancelarReserva: (id: string, data: any) =>
    api.post(`/alquileres/reservas/${id}/cancelar`, data).then(r => r.data),
  
  getReservasSede: (sedeId: string, fecha?: string) =>
    api.get(`/alquileres/sede/${sedeId}/reservas`, { params: { fecha } }).then(r => r.data),
  
  aprobarReserva: (id: string) => api.post(`/alquileres/reservas/${id}/aprobar`).then(r => r.data),
  rechazarReserva: (id: string, motivo?: string) =>
    api.post(`/alquileres/reservas/${id}/rechazar`, { motivo }).then(r => r.data),
};
