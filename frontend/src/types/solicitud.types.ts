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
  /** Solo aplica a ANDAMIO_SIMPLE: indica si se rentan con madera */
  conMadera?:  boolean;
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
  const rate = item.conMadera
    ? getRentaRate(item.unidad, item.config.rentaDiaConMadera, item.config.rentaSemanaConMadera, item.config.rentaMesConMadera)
    : getRentaRate(item.unidad, item.config.rentaDia, item.config.rentaSemana, item.config.rentaMes);
  return (rate ?? 0) * item.cantidad * item.duracion;
}

export function formatQ(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formatea una fecha ISO de solo día ("2026-04-14") — añade hora local para evitar desfase UTC. */
export function formatFechaCorta(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

/** Formatea un datetime ISO completo como fecha corta ("14/04/26"). */
export function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

/** Formatea un datetime ISO completo como fecha + hora ("14/04/26 · 09:32 a. m."). */
export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
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
