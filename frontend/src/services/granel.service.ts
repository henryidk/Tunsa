import { api } from './auth.service';

export type TipoGranel = 'PUNTAL' | 'ANDAMIO_SIMPLE' | 'ANDAMIO_RUEDAS';

export interface LoteGranel {
  id:             string;
  tipo:           TipoGranel;
  descripcion:    string;
  cantidad:       number;
  precioUnitario: number;
  fechaCompra:    string | null;
  ubicacion:      string | null;
  isActive:       boolean;
  createdAt:      string;
  updatedAt:      string;
}

export interface ConfigGranel {
  tipo:                 TipoGranel;
  rentaDia:             number;
  rentaSemana:          number;
  rentaMes:             number;
  // Solo presente para ANDAMIO_SIMPLE
  rentaDiaConMadera:    number | null;
  rentaSemanaConMadera: number | null;
  rentaMesConMadera:    number | null;
  updatedAt:            string;
}

export interface GranelResponse {
  lotes:      LoteGranel[];
  stockTotal: number;
  config:     ConfigGranel | null;
}

interface CreateLoteData {
  tipo:           TipoGranel;
  descripcion:    string;
  cantidad:       number;
  precioUnitario: number;
  fechaCompra?:   string;
  ubicacion?:     string;
}

interface UpdateLoteData {
  descripcion?:    string;
  cantidad?:       number;
  precioUnitario?: number;
  fechaCompra?:    string;
  ubicacion?:      string;
}

interface UpdateConfigData {
  tipo:                 TipoGranel;
  rentaDia:             number;
  rentaSemana:          number;
  rentaMes:             number;
  rentaDiaConMadera?:    number;
  rentaSemanaConMadera?: number;
  rentaMesConMadera?:    number;
}

export const granelService = {
  async getAll(tipo: TipoGranel): Promise<GranelResponse> {
    const res = await api.get<GranelResponse>('/granel', { params: { tipo } });
    return res.data;
  },

  async create(data: CreateLoteData): Promise<LoteGranel> {
    const res = await api.post<LoteGranel>('/granel', data);
    return res.data;
  },

  async update(id: string, data: UpdateLoteData): Promise<LoteGranel> {
    const res = await api.patch<LoteGranel>(`/granel/${id}`, data);
    return res.data;
  },

  async darDeBaja(id: string): Promise<LoteGranel> {
    const res = await api.patch<LoteGranel>(`/granel/${id}/baja`);
    return res.data;
  },

  async updateConfig(data: UpdateConfigData): Promise<ConfigGranel> {
    const res = await api.patch<ConfigGranel>('/granel/config', data);
    return res.data;
  },
};
