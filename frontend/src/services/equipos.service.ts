import type { Equipo } from '../types/equipo.types';
import { api } from './auth.service';

export interface BitacoraEntry {
  id:            string;
  modulo:        'equipo' | 'usuario';
  entidadId:     string;
  entidadNombre: string;
  campo:         string;
  valorAnterior: string | null;
  valorNuevo:    string | null;
  realizadoPor:  string;
  createdAt:     string;
}

interface CreateEquipoData {
  numeracion:  string;
  descripcion: string;
  categoria:   string;
  serie?:       string;
  cantidad?:    number;
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

  async getBitacoras(): Promise<BitacoraEntry[]> {
    const res = await api.get<BitacoraEntry[]>('/bitacoras');
    return res.data;
  },
};
