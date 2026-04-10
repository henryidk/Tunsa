import { api } from './auth.service';
import type { SolicitudRenta } from '../types/solicitud-renta.types';
import type { ItemSnapshot, ModalidadPago } from '../types/solicitud-renta.types';

interface CreateSolicitudPayload {
  clienteId:     string;
  modalidad:     ModalidadPago;
  notas:         string;
  totalEstimado: number;
  items:         ItemSnapshot[];
}

export const solicitudesService = {
  async create(payload: CreateSolicitudPayload): Promise<SolicitudRenta> {
    const res = await api.post<SolicitudRenta>('/solicitudes', payload);
    return res.data;
  },

  async getAll(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes');
    return res.data;
  },

  async getMias(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/mias');
    return res.data;
  },

  async getEquiposReservados(): Promise<string[]> {
    const res = await api.get<string[]>('/solicitudes/equipos-reservados');
    return res.data;
  },

  async rechazar(id: string): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/rechazar`);
    return res.data;
  },

  async getMiasHistorial(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/historial-mias');
    return res.data;
  },
};
