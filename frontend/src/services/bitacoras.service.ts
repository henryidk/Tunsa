import { api } from './auth.service';

export interface BitacoraEntry {
  id:            string;
  modulo:        string;
  entidadId:     string;
  entidadNombre: string;
  campo:         string;
  valorAnterior: string | null;
  valorNuevo:    string | null;
  realizadoPor:  string;
  createdAt:     string;
}

export interface BitacoraPageParams {
  cursor?:  string;
  modulo?:  string;
  search?:  string;
}

export interface BitacoraPageResult {
  data:       BitacoraEntry[];
  nextCursor: string | null;
}

export interface BitacoraStats {
  total:     number;
  hoy:       number;
  porModulo: Record<string, number>;
}

export const bitacorasService = {
  async getStats(): Promise<BitacoraStats> {
    const res = await api.get<BitacoraStats>('/bitacoras/stats');
    return res.data;
  },

  async getBitacoras(params: BitacoraPageParams = {}): Promise<BitacoraPageResult> {
    const res = await api.get<BitacoraPageResult>('/bitacoras', { params });
    return res.data;
  },
};
