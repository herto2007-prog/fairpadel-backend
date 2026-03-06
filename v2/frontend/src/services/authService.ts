import { api } from './api';
import type { AuthResponse, LoginCredentials, RegisterCredentials } from '../types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', credentials);
    return response.data;
  },

  async me(): Promise<{ user: AuthResponse['user'] }> {
    const response = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
    return response.data;
  },
};
