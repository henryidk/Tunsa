import { api } from './auth.service';

export interface Cliente {
  id:        string;   // CLI-0001
  nombre:    string;
  dpi:       string;
  telefono?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateClienteData {
  nombre:   string;
  dpi:      string;
  telefono?: string;
}

interface UpdateClienteData extends Partial<CreateClienteData> {}

export const clientesService = {
  async getAll(): Promise<Cliente[]> {
    const res = await api.get<Cliente[]>('/clientes');
    return res.data;
  },

  async create(data: CreateClienteData): Promise<Cliente> {
    const res = await api.post<Cliente>('/clientes', data);
    return res.data;
  },

  async update(id: string, data: UpdateClienteData): Promise<Cliente> {
    const res = await api.patch<Cliente>(`/clientes/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/clientes/${id}`);
  },
};
