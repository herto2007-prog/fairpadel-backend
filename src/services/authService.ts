import { api } from './api';

export interface LoginData {
  documento: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string;
  genero: 'MASCULINO' | 'FEMENINO';
}

export const authService = {
  login: (data: LoginData) => api.post('/auth/login', data).then(r => r.data),
  register: (data: RegisterData) => api.post('/auth/register', data).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
};
