import { api } from './auth.service';

export const categoriasService = {
  async getAll(): Promise<string[]> {
    const res = await api.get<string[]>('/categorias');
    return res.data;
  },
};
