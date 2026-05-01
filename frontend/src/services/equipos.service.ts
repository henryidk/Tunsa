import type { Equipo } from '../types/equipo.types';
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

interface CreateEquipoData {
  numeracion:        string;
  descripcion:       string;
  tipoId:            string;
  categoriaId?:      string;
  serie?:            string;
  fechaCompra:       string;
  montoCompra:       number;
  rentaHora?:        number;
  rentaHoraMartillo?: number;
  rentaDia?:         number;
  rentaSemana?:      number;
  rentaMes?:         number;
}

interface UpdateEquipoData extends Partial<Omit<CreateEquipoData, 'categoriaId'>> {
  categoriaId?: string | null;
}

interface BajaEquipoData {
  motivo?: string;
}

export const equiposService = {
  async getAll(): Promise<Equipo[]> {
    // pageSize=500 carga todos los equipos de una ferretería en una sola llamada
    // manteniendo siempre un LIMIT en la consulta SQL
    const res = await api.get<{ data: Equipo[] }>('/equipos', { params: { pageSize: 500 } });
    return res.data.data;
  },

  async create(data: CreateEquipoData): Promise<Equipo> {
    const res = await api.post<Equipo>('/equipos', data);
    return res.data;
  },

  async update(id: string, data: UpdateEquipoData): Promise<Equipo> {
    const res = await api.patch<Equipo>(`/equipos/${id}`, data);
    return res.data;
  },

  async darDeBaja(id: string, data: BajaEquipoData): Promise<Equipo> {
    const res = await api.patch<Equipo>(`/equipos/${id}/baja`, data);
    return res.data;
  },

  async reactivar(id: string): Promise<Equipo> {
    const res = await api.patch<Equipo>(`/equipos/${id}/reactivar`);
    return res.data;
  },

  async getBitacoraStats(): Promise<BitacoraStats> {
    const res = await api.get<BitacoraStats>('/bitacoras/stats');
    return res.data;
  },

  async getBitacoras(params: BitacoraPageParams = {}): Promise<BitacoraPageResult> {
    const res = await api.get<BitacoraPageResult>('/bitacoras', { params });
    return res.data;
  },
};
