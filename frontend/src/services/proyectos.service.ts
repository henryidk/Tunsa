import { api } from './auth.service';
import type {
  Proyecto,
  ProyectoResumen,
  ProyectoSolicitudes,
  CreateProyectoData,
  UpdateProyectoData,
} from '../types/proyecto.types';

export const proyectosService = {
  async getAll(params?: { clienteId?: string; estado?: string }): Promise<Proyecto[]> {
    const res = await api.get<Proyecto[]>('/proyectos', { params });
    return res.data;
  },

  async getByCliente(clienteId: string): Promise<ProyectoResumen[]> {
    const res = await api.get<ProyectoResumen[]>(`/proyectos/por-cliente/${clienteId}`);
    return res.data;
  },

  async getOne(id: string): Promise<Proyecto> {
    const res = await api.get<Proyecto>(`/proyectos/${id}`);
    return res.data;
  },

  async getSolicitudes(proyectoId: string): Promise<ProyectoSolicitudes> {
    const res = await api.get<ProyectoSolicitudes>(`/proyectos/${proyectoId}/solicitudes`);
    return res.data;
  },

  async create(data: CreateProyectoData): Promise<Proyecto> {
    const res = await api.post<Proyecto>('/proyectos', data);
    return res.data;
  },

  async update(id: string, data: UpdateProyectoData): Promise<Proyecto> {
    const res = await api.patch<Proyecto>(`/proyectos/${id}`, data);
    return res.data;
  },

  async finalizar(id: string): Promise<Proyecto> {
    const res = await api.post<Proyecto>(`/proyectos/${id}/finalizar`);
    return res.data;
  },

  async reactivar(id: string): Promise<Proyecto> {
    const res = await api.post<Proyecto>(`/proyectos/${id}/reactivar`);
    return res.data;
  },

  async asignarSolicitud(solicitudId: string, proyectoId: string): Promise<void> {
    await api.post(`/solicitudes/${solicitudId}/asignar-proyecto`, { proyectoId });
  },
};
