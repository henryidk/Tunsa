import { api } from './auth.service';
import type { SolicitudRenta } from '../types/solicitud-renta.types';
import type { ItemSnapshot, ModalidadPago } from '../types/solicitud-renta.types';

export interface RechazadasPage {
  data:       SolicitudRenta[];
  nextCursor: string | null;
}

export interface QueryRechazadas {
  fechaDesde: string; // ISO date string
  fechaHasta: string; // ISO date string
  cursor?:    string;
}

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

  async aprobar(id: string): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/aprobar`);
    return res.data;
  },

  async rechazar(id: string, motivoRechazo: string): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/rechazar`, { motivoRechazo });
    return res.data;
  },

  async iniciarEntrega(id: string): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/iniciar-entrega`);
    return res.data;
  },

  async confirmarEntrega(
    id:           string,
    comprobante:  File,
    onProgress?:  (pct: number) => void,
  ): Promise<SolicitudRenta> {
    const form = new FormData();
    form.append('comprobante', comprobante);
    const res = await api.patch<SolicitudRenta>(
      `/solicitudes/${id}/confirmar-entrega`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
          ? (e) => { if (e.total) onProgress(Math.round((e.loaded * 100) / e.total)); }
          : undefined,
      },
    );
    return res.data;
  },

  async getComprobanteUrl(id: string): Promise<{ url: string }> {
    const res = await api.get<{ url: string }>(`/solicitudes/${id}/comprobante`);
    return res.data;
  },

  async getActivas(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/activas');
    return res.data;
  },

  async getActivasMias(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/activas-mias');
    return res.data;
  },

  async getVencidasMias(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/vencidas-mias');
    return res.data;
  },

  async registrarDevolucion(id: string): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/registrar-devolucion`);
    return res.data;
  },

  async getMiasHistorial(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/historial-mias', { params });
    return res.data;
  },

  async getRechazadas(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/rechazadas', { params });
    return res.data;
  },
};
