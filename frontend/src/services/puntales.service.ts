import { api } from './auth.service';

export interface PuntalLote {
  id:             string;
  descripcion:    string;
  cantidad:       number;
  precioUnitario: number;
  fechaCompra:    string | null;
  ubicacion:      string | null;
  isActive:       boolean;
  createdAt:      string;
  updatedAt:      string;
}

export interface PuntalesConfig {
  id:          number;
  rentaDia:    number;
  rentaSemana: number;
  rentaMes:    number;
  updatedAt:   string;
}

export interface PuntalesResponse {
  lotes:      PuntalLote[];
  stockTotal: number;
  config:     PuntalesConfig | null;
}

interface CreatePuntalData {
  descripcion:    string;
  cantidad:       number;
  precioUnitario: number;
  fechaCompra?:   string;
  ubicacion?:     string;
}

interface UpdatePuntalData extends Partial<CreatePuntalData> {}

interface UpdateConfigData {
  rentaDia:    number;
  rentaSemana: number;
  rentaMes:    number;
}

export const puntalesService = {
  async getAll(): Promise<PuntalesResponse> {
    const res = await api.get<PuntalesResponse>('/puntales');
    return res.data;
  },

  async create(data: CreatePuntalData): Promise<PuntalLote> {
    const res = await api.post<PuntalLote>('/puntales', data);
    return res.data;
  },

  async update(id: string, data: UpdatePuntalData): Promise<PuntalLote> {
    const res = await api.patch<PuntalLote>(`/puntales/${id}`, data);
    return res.data;
  },

  async darDeBaja(id: string): Promise<PuntalLote> {
    const res = await api.patch<PuntalLote>(`/puntales/${id}/baja`);
    return res.data;
  },

  async updateConfig(data: UpdateConfigData): Promise<PuntalesConfig> {
    const res = await api.patch<PuntalesConfig>('/puntales/config', data);
    return res.data;
  },
};
