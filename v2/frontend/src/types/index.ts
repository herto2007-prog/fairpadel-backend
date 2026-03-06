// User types
export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  documento: string;
  roles: string[];
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
}

// API Error
export interface ApiError {
  message: string;
  statusCode: number;
}
