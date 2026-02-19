// Tipos para el sistema de autenticación - Proyecto Tunsa

// Roles disponibles en el sistema
export type RoleName = 'admin' | 'secretaria' | 'colaborador' | 'encargado_maquinas';

// Estructura del rol
export interface Role {
  id: string;
  nombre: RoleName;
  descripcion: string;
  createdAt: string;
}

// Estructura del usuario (lo que devuelve el backend)
export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  telefono: string | null;
  isActive: boolean;
  roleId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

// Datos para el login
export interface LoginCredentials {
  username: string;
  password: string;
}

// Respuesta del endpoint /auth/login
export interface LoginResponse {
  accessToken: string;
  user: Usuario;
}

// Respuesta del endpoint /auth/refresh
export interface RefreshResponse {
  accessToken: string;
}

// Respuesta del endpoint /auth/profile
export interface ProfileResponse {
  user: Usuario;
}

// Estado de autenticación para el store
export interface AuthState {
  user: Usuario | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Acciones del store de autenticación
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
  checkAuth: () => void;
}

// Store completo (estado + acciones)
export type AuthStore = AuthState & AuthActions;
