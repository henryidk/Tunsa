import type { Equipo } from '../types/equipo.types';
import type { FlotaItem } from '../types/flota.types';
import { api } from './auth.service';

export interface ExtraEquipoInput {
  tipoExtraId: string;
  rentaHora:   number;
}

export interface TipoExtra {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  createdAt:   string;
  updatedAt:   string;
}

interface CreateEquipoData {
  numeracion:   string;
  descripcion:  string;
  tipoId:       string;
  categoriaId?: string;
  serie?:       string;
  fechaCompra:  string;
  montoCompra:  number;
  rentaHora?:   number;
  rentaDia?:    number;
  rentaSemana?: number;
  rentaMes?:    number;
  extras?:      ExtraEquipoInput[];
}

interface UpdateEquipoData extends Partial<Omit<CreateEquipoData, 'categoriaId'>> {
  categoriaId?: string | null;
  extras?:      ExtraEquipoInput[] | null;
}

interface BajaEquipoData {
  motivo?: string;
}

export const extrasService = {
  async getAll(): Promise<TipoExtra[]> {
    const res = await api.get<TipoExtra[]>('/extras');
    return res.data;
  },

  async create(data: { nombre: string; descripcion?: string }): Promise<TipoExtra> {
    const res = await api.post<TipoExtra>('/extras', data);
    return res.data;
  },

  async update(id: string, data: { nombre?: string; descripcion?: string }): Promise<TipoExtra> {
    const res = await api.patch<TipoExtra>(`/extras/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/extras/${id}`);
  },
};

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

  async getDisponibilidad(): Promise<FlotaItem[]> {
    const res = await api.get<FlotaItem[]>('/equipos/disponibilidad');
    return res.data;
  },

};
