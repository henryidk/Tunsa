import type { Usuario } from '../types/auth.types';
import { api } from './auth.service';

interface UpdateUsuarioData {
  nombre?: string;
  username?: string;
  telefono?: string;
}

interface CreateUsuarioData {
  nombre: string;
  username: string;
  telefono?: string;
  rol: string;
}

export interface CreateUsuarioResponse extends Usuario {
  temporaryPassword: string;
}

export const usuariosService = {
  async getAll(): Promise<Usuario[]> {
    const response = await api.get<Usuario[]>('/users');
    return response.data;
  },

  async create(data: CreateUsuarioData): Promise<CreateUsuarioResponse> {
    const response = await api.post<CreateUsuarioResponse>('/users', data);
    return response.data;
  },

  async update(id: string, data: UpdateUsuarioData): Promise<Usuario> {
    const response = await api.patch<Usuario>(`/users/${id}`, data);
    return response.data;
  },

  async deactivate(id: string): Promise<Usuario> {
    const response = await api.patch<Usuario>(`/users/${id}/deactivate`);
    return response.data;
  },

  async activate(id: string): Promise<Usuario> {
    const response = await api.patch<Usuario>(`/users/${id}/activate`);
    return response.data;
  },

  async resetPassword(id: string): Promise<CreateUsuarioResponse> {
    const response = await api.patch<CreateUsuarioResponse>(`/users/${id}/reset-password`);
    return response.data;
  },

  async changePassword(newPassword: string): Promise<void> {
    await api.patch('/users/change-password', { newPassword });
  },
};
