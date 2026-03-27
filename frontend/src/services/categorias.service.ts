import { api } from './auth.service';
import type { Categoria, TipoConCategorias } from '../types/equipo.types';

// Tipo exclusivo del panel de administración (incluye conteo de equipos)
export interface CategoriaAdmin {
  id:      string;
  nombre:  string;
  tipoId:  string;
  _count:  { equipos: number };
}

export interface TipoAdmin {
  id:         string;
  nombre:     string;
  categorias: CategoriaAdmin[];
}

export interface TipoAdminNuevo {
  id:          string;
  nombre:      string;
  descripcion: string;
  categorias:  CategoriaAdmin[];
}

export const categoriasService = {
  /** GET /categorias/tipos — para formularios de equipo */
  async getTipos(): Promise<TipoConCategorias[]> {
    const res = await api.get<TipoConCategorias[]>('/categorias/tipos');
    return res.data;
  },

  /** GET /categorias/admin — para el panel de administración (con conteo) */
  async getTiposAdmin(): Promise<TipoAdmin[]> {
    const res = await api.get<TipoAdmin[]>('/categorias/admin');
    return res.data;
  },

  /** GET /categorias */
  async getAll(): Promise<Categoria[]> {
    const res = await api.get<Categoria[]>('/categorias');
    return res.data;
  },

  /** GET /categorias?tipoId=xxx */
  async getByTipo(tipoId: string): Promise<Categoria[]> {
    const res = await api.get<Categoria[]>(`/categorias?tipoId=${tipoId}`);
    return res.data;
  },

  /** POST /categorias/tipos — crea un nuevo tipo */
  async createTipo(nombre: string, descripcion?: string): Promise<TipoAdminNuevo> {
    const res = await api.post<TipoAdminNuevo>('/categorias/tipos', { nombre, descripcion });
    return res.data;
  },

  /** POST /categorias */
  async create(nombre: string, tipoId: string): Promise<CategoriaAdmin> {
    const res = await api.post<CategoriaAdmin>('/categorias', { nombre, tipoId });
    return res.data;
  },

  /** PATCH /categorias/:id */
  async update(id: string, nombre: string): Promise<CategoriaAdmin> {
    const res = await api.patch<CategoriaAdmin>(`/categorias/${id}`, { nombre });
    return res.data;
  },

  /** DELETE /categorias/:id */
  async delete(id: string): Promise<void> {
    await api.delete(`/categorias/${id}`);
  },

  /** DELETE /categorias/tipos/:id */
  async deleteTipo(id: string): Promise<void> {
    await api.delete(`/categorias/tipos/${id}`);
  },
};
