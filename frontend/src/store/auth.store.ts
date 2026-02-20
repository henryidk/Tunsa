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

  getMustChangePassword: (): boolean => localStorage.getItem('mustChangePassword') === 'true',

  setAuth: (user: Usuario, accessToken: string, mustChangePassword: boolean) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('mustChangePassword', String(mustChangePassword));
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('mustChangePassword');
  },
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storage.getUser(),
  accessToken: storage.getAccessToken(),
  refreshToken: null,
  isAuthenticated: !!storage.getAccessToken(),
  isLoading: false,
  error: null,
  mustChangePassword: storage.getMustChangePassword(),

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.login(credentials);
      const { user, accessToken, mustChangePassword } = response;

      storage.setAuth(user, accessToken, mustChangePassword ?? false);

      set({
        user,
        accessToken,
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mustChangePassword: mustChangePassword ?? false,
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
        mustChangePassword: false,
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
        mustChangePassword: false,
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
        mustChangePassword: false,
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
        mustChangePassword: storage.getMustChangePassword(),
      });
    } else {
      storage.clearAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        mustChangePassword: false,
      });
    }
  },

  setMustChangePassword: (value: boolean) => {
    localStorage.setItem('mustChangePassword', String(value));
    set({ mustChangePassword: value });
  },

  clearError: () => set({ error: null }),
}));

export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectError = (state: AuthStore) => state.error;
export const selectUserRole = (state: AuthStore) => state.user?.role.nombre;
export const selectMustChangePassword = (state: AuthStore) => state.mustChangePassword;
