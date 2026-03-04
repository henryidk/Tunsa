import type { Equipo } from '../types/equipo.types';
import { api } from './auth.service';

interface CreateEquipoData {
  numeracion:  string;
  descripcion: string;
  categoria:   string;
  serie?:       string;
  fechaCompra:  string;
  montoCompra:  number;
  tipo:         string;
  rentaDia?:    number;
  rentaSemana?: number;
  rentaMes?:    number;
}

interface UpdateEquipoData extends Partial<CreateEquipoData> {}

interface BajaEquipoData {
  motivo?: string;
}

export const equiposService = {
  async getAll(): Promise<Equipo[]> {
    const res = await api.get<Equipo[]>('/equipos');
    return res.data;
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
};
