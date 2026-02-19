import type { Usuario } from '../types/auth.types';
import { api } from './auth.service';

export const usuariosService = {
  async getAll(): Promise<Usuario[]> {
    const response = await api.get<Usuario[]>('/users');
    return response.data;
  },
};
