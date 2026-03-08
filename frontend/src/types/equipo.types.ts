export type TipoMaquinaria = 'LIVIANA' | 'PESADA' | 'USO_PROPIO';

export interface Equipo {
  id:          string;
  numeracion:  string;
  descripcion: string;
  categoria:   string;
  serie:       string | null;
  cantidad:    number;
  fechaCompra: string;
  montoCompra: number;
  tipo:        TipoMaquinaria;
  rentaDia:    number | null;
  rentaSemana: number | null;
  rentaMes:    number | null;
  isActive:    boolean;
  motivoBaja:  string | null;
  fechaBaja:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

export const TIPO_LABEL: Record<TipoMaquinaria, string> = {
  LIVIANA:   'Maq. Liviana',
  PESADA:    'Maq. Pesada',
  USO_PROPIO: 'Uso Propio',
};

export const TIPO_BADGE: Record<TipoMaquinaria, string> = {
  LIVIANA:   'bg-blue-100 text-blue-700',
  PESADA:    'bg-amber-100 text-amber-700',
  USO_PROPIO: 'bg-slate-100 text-slate-600',
};
