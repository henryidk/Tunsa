export type TipoMaquinaria = 'LIVIANA' | 'PESADA' | 'USO_PROPIO';

export interface Equipo {
  id:          string;
  numeracion:  string;
  descripcion: string;
  categoria:   string;
  serie:       string | null;
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

export const CATEGORIAS_EQUIPO = [
  'Bailarina',
  'Barreno',
  'Bomba de agua',
  'Bomba p/sólidos',
  'Chapeadora',
  'Compresor',
  'Cortadora de concreto',
  'Generador eléctrico',
  'Generador soldador',
  'Helicóptero',
  'Hidrolavadora',
  'Martillo demoledor',
  'Medidor de presión',
  'Mezcladora',
  'Minicargador',
  'Montacarga',
  'Motosierra',
  'Plancha alizadora',
  'Plato vibratorio',
  'Rastrío',
  'Regla vibratoria',
  'Retroexcavadora',
  'Rodo compactador',
  'Sopladora',
  'Vibrador de concreto',
] as const;

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
