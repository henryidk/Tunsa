// Store de autenticación con Zustand - Proyecto Tunsa

import { create } from 'zustand';
import { authService } from '../services/auth.service';
import type {
  AuthStore,
  LoginCredentials,
  Usuario
} from '../types/auth.types';

const storage = {
  getUser: (): Usuario | null => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  getAccessToken: (): string | null => localStorage.getItem('accessToken'),

  setAuth: (user: Usuario, accessToken: string) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
  },
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storage.getUser(),
  accessToken: storage.getAccessToken(),
  refreshToken: null,
  isAuthenticated: !!storage.getAccessToken(),
  isLoading: false,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.login(credentials);
      const { user, accessToken } = response;

      storage.setAuth(user, accessToken);

      set({
        user,
        accessToken,
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      let errorMessage = 'Error al iniciar sesión';

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        errorMessage = axiosError.response?.data?.message || errorMessage;
      }

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      await authService.logout();
    } catch (error) {
      console.warn('Error durante logout:', error);
    } finally {
      storage.clearAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  refreshAccessToken: async (): Promise<boolean> => {
    try {
      const response = await authService.refreshToken();
      const { accessToken } = response;

      localStorage.setItem('accessToken', accessToken);
      set({ accessToken });

      return true;
    } catch (error) {
      console.error('Error renovando token:', error);
      storage.clearAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
      return false;
    }
  },

  checkAuth: () => {
    const accessToken = storage.getAccessToken();
    const user = storage.getUser();

    if (accessToken && user) {
      set({
        user,
        accessToken,
        refreshToken: null,
        isAuthenticated: true,
      });
    } else {
      storage.clearAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectError = (state: AuthStore) => state.error;
export const selectUserRole = (state: AuthStore) => state.user?.role.nombre;
