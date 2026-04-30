import type { LecturaHorometro } from '../services/solicitudes.service';

export type DiaStatus = 'completo' | 'parcial' | 'sin-registro';

/** Fecha local de un Date como "YYYY-MM-DD" (sin conversión UTC). */
export function localDateOf(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function today(): string {
  return localDateOf(new Date());
}

export function generarDias(inicio: string, fin: string): string[] {
  const days: string[] = [];
  let current = new Date(inicio + 'T00:00:00');
  const end   = new Date(fin   + 'T00:00:00');
  while (current <= end) {
    days.push(localDateOf(current));
    current = new Date(current.getTime() + 86_400_000);
  }
  return days;
}

export function getDiaStatus(lecturas: LecturaHorometro[], fecha: string): DiaStatus {
  const l = lecturas.find(l => l.fecha === fecha);
  if (!l) return 'sin-registro';
  return l.horometroFin5pm !== null ? 'completo' : 'parcial';
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

export const DIA_BG: Record<DiaStatus, string> = {
  'completo':     'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200',
  'parcial':      'bg-amber-100   text-amber-700   border-amber-200   hover:bg-amber-200',
  'sin-registro': 'bg-red-100     text-red-700     border-red-200     hover:bg-red-200',
};

export const DIA_ICON: Record<DiaStatus, string> = {
  'completo':     '✓',
  'parcial':      '~',
  'sin-registro': '!',
};

export const DIA_LABEL: Record<DiaStatus, string> = {
  'completo':     'Completo',
  'parcial':      'Solo inicio',
  'sin-registro': 'Sin registro',
};
