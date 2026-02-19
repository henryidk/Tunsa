import type { Usuario } from '../types/auth.types';
import { api } from './auth.service';

interface UpdateUsuarioData {
  nombre?: string;
  username?: string;
  telefono?: string;
}

export const usuariosService = {
  async getAll(): Promise<Usuario[]> {
    const response = await api.get<Usuario[]>('/users');
    return response.data;
  },

  async update(id: string, data: UpdateUsuarioData): Promise<Usuario> {
    const response = await api.patch<Usuario>(`/users/${id}`, data);
    return response.data;
  },
};
