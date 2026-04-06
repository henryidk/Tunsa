import { api } from './auth.service';

export interface Cliente {
  id:           string;   // CLI-0001
  nombre:       string;
  dpi:          string;
  telefono?:    string | null;
  documentoKey: string | null;
  createdAt:    string;
  updatedAt:    string;
}

interface CreateClienteData {
  nombre:    string;
  dpi:       string;
  telefono?: string;
}

interface UpdateClienteData extends Partial<CreateClienteData> {}

export const clientesService = {
  async getAll(): Promise<Cliente[]> {
    const res = await api.get<{ data: Cliente[] }>('/clientes', { params: { pageSize: 500 } });
    return res.data.data;
  },

  async checkDpi(dpi: string): Promise<{ exists: boolean }> {
    const res = await api.get<{ exists: boolean }>('/clientes/check-dpi', { params: { dpi } });
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

  async uploadDocumento(clienteId: string, file: File): Promise<{ documentoKey: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ documentoKey: string }>(
      `/clientes/${clienteId}/documento`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },

  async getDocumentoUrl(clienteId: string): Promise<string> {
    const res = await api.get<{ url: string }>(`/clientes/${clienteId}/documento`);
    return res.data.url;
  },
};
