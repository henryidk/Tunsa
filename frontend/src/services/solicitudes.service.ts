import { api } from './auth.service';
import type { SolicitudRenta, UnidadDuracion } from '../types/solicitud-renta.types';
import type { ItemSnapshot, ModalidadPago } from '../types/solicitud-renta.types';

export interface ExtensionItemPayload {
  itemRef:  string;
  kind:     'maquinaria' | 'granel' | 'pesada';
  duracion: number;
  unidad:   UnidadDuracion;
}

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
  clienteId:      string;
  modalidad:      ModalidadPago;
  notas:          string;
  totalEstimado?: number;
  items:          ItemSnapshot[];
}

export interface LecturaHorometro {
  id:                    string;
  solicitudId:           string;
  equipoId:              string;
  fecha:                 string;
  horometroInicio:       number | null;
  horometroFin5pm:       number | null;
  horasNocturnas:        number | null;
  horasDiurnasRaw:       number | null;
  horasDiurnasFacturadas: number | null;
  ajusteMinimo:          number | null;
  tarifaEfectiva:        number | null;
  costoDiurno:           number | null;
  costoNocturno:         number | null;
  costoTotal:            number | null;
  registradoInicioBy:    string | null;
  registradoFinBy:       string | null;
  createdAt:             string;
  updatedAt:             string;
}

export interface DashboardStats {
  pendientes:         number;
  activas:            number;
  vencidas:           number;
  solicitudesEsteMes: number;
}

export const solicitudesService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>('/solicitudes/dashboard-stats');
    return res.data;
  },

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

  async iniciarEntrega(
    id: string,
    horometrosIniciales?: { equipoId: string; valor: number }[],
  ): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(
      `/solicitudes/${id}/iniciar-entrega`,
      horometrosIniciales?.length ? { horometrosIniciales } : {},
    );
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

  async getVencidas(): Promise<SolicitudRenta[]> {
    const res = await api.get<SolicitudRenta[]>('/solicitudes/vencidas');
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

  async ampliar(id: string, items: ExtensionItemPayload[]): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(`/solicitudes/${id}/ampliar`, { items });
    return res.data;
  },

  async registrarDevolucion(
    id:   string,
    data?: {
      itemRefs?:             string[];
      recargosAdicionales?:  { descripcion: string; monto: number }[];
    },
  ): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(
      `/solicitudes/${id}/registrar-devolucion`,
      data ?? {},
    );
    return res.data;
  },

  async subirLiquidacion(id: string, pdfBlob: Blob): Promise<{ url: string }> {
    const form = new FormData();
    form.append('liquidacion', pdfBlob, 'liquidacion.pdf');
    const res = await api.patch<{ url: string }>(
      `/solicitudes/${id}/liquidacion`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },

  async getHistorial(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/historial', { params });
    return res.data;
  },

  async getMiasHistorial(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/historial-mias', { params });
    return res.data;
  },

  async getRechazadasMias(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/rechazadas-mias', { params });
    return res.data;
  },

  async getLiquidacionUrl(id: string, loteIndex: number): Promise<{ url: string }> {
    const res = await api.get<{ url: string }>(`/solicitudes/${id}/liquidacion/${loteIndex}`);
    return res.data;
  },

  async getRechazadas(params: QueryRechazadas): Promise<RechazadasPage> {
    const res = await api.get<RechazadasPage>('/solicitudes/rechazadas', { params });
    return res.data;
  },

  // ── Horómetro (maquinaria pesada) ─────────────────────────────────────────

  async registrarLectura(
    solicitudId: string,
    data: { equipoId: string; fecha: string; tipo: 'inicio' | 'fin5pm'; valor: number },
  ): Promise<LecturaHorometro> {
    const res = await api.post<LecturaHorometro>(
      `/solicitudes/${solicitudId}/horometro/lecturas`,
      data,
    );
    return res.data;
  },

  async getLecturas(solicitudId: string): Promise<LecturaHorometro[]> {
    const res = await api.get<LecturaHorometro[]>(`/solicitudes/${solicitudId}/horometro`);
    return res.data;
  },

  async registrarDevolucionPesada(
    solicitudId: string,
    data: {
      items?: { equipoId: string; horometroDevolucion: number }[];
      recargosAdicionales?: { descripcion: string; monto: number }[];
    },
  ): Promise<SolicitudRenta> {
    const res = await api.patch<SolicitudRenta>(
      `/solicitudes/${solicitudId}/registrar-devolucion-pesada`,
      data,
    );
    return res.data;
  },
};
