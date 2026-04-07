import type { Equipo } from './equipo.types';
import type { TipoGranel, ConfigGranel } from '../services/granel.service';

export type UnidadDuracion  = 'dias' | 'semanas' | 'meses';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';

export interface ItemMaquinaria {
  kind:        'maquinaria';
  equipo:      Equipo;
  fechaInicio: string;
  duracion:    number;
  unidad:      UnidadDuracion;
}

export interface ItemGranel {
  kind:        'granel';
  tipo:        TipoGranel;
  tipoLabel:   string;
  cantidad:    number;
  fechaInicio: string;
  duracion:    number;
  unidad:      UnidadDuracion;
  config:      ConfigGranel | null;
}

export type ItemSolicitud = ItemMaquinaria | ItemGranel;

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function getRentaRate(
  unidad: UnidadDuracion,
  dia?:    number | null,
  semana?: number | null,
  mes?:    number | null,
): number | null {
  if (unidad === 'dias')    return dia    ?? null;
  if (unidad === 'semanas') return semana ?? null;
  return mes ?? null;
}

export function calcSubtotal(item: ItemSolicitud): number {
  if (item.kind === 'maquinaria') {
    const rate = getRentaRate(item.unidad, item.equipo.rentaDia, item.equipo.rentaSemana, item.equipo.rentaMes);
    return (rate ?? 0) * item.duracion;
  }
  if (!item.config) return 0;
  const rate = getRentaRate(item.unidad, item.config.rentaDia, item.config.rentaSemana, item.config.rentaMes);
  return (rate ?? 0) * item.cantidad * item.duracion;
}

export function formatQ(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

export function unidadLabel(n: number, u: UnidadDuracion): string {
  if (u === 'dias')    return n === 1 ? '1 día'    : `${n} días`;
  if (u === 'semanas') return n === 1 ? '1 semana' : `${n} semanas`;
  return n === 1 ? '1 mes' : `${n} meses`;
}

export function rateSuffix(u: UnidadDuracion): string {
  return u === 'dias' ? '/día' : u === 'semanas' ? '/sem' : '/mes';
}
