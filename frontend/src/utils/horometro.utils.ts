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

/**
 * Último día que requiere lecturas regulares de horómetro (inicio + fin5pm).
 * El día calendario de vencimiento es el día de entrega — el equipo no trabaja ese día.
 * Acotado por hoy: no se pueden registrar días futuros aunque la renta siga activa.
 */
export function ultimoDiaHorometro(fechaFinEstimada: string | null | undefined): string {
  if (!fechaFinEstimada) return today();
  const diaEntrega = new Date(fechaFinEstimada.substring(0, 10) + 'T00:00:00');
  diaEntrega.setDate(diaEntrega.getDate() - 1);
  const ultimoDia = localDateOf(diaEntrega);
  const hoy = today();
  return ultimoDia <= hoy ? ultimoDia : hoy;
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

/**
 * Devuelve los días entre fechaInicioRenta y el día anterior a fechaActiva
 * que no tienen registro completo (inicio + fin5pm).
 * Lista vacía indica que no hay pendientes y se puede proceder.
 */
export function diasPendientesAnteriores(
  fechaActiva:      string,
  fechaInicioRenta: string,
  lecturasEquipo:   LecturaHorometro[] | null | undefined,
): string[] {
  if (!lecturasEquipo) return [];
  const ayer = new Date(fechaActiva + 'T00:00:00');
  ayer.setDate(ayer.getDate() - 1);
  const fechaAyer = localDateOf(ayer);
  if (fechaAyer < fechaInicioRenta) return [];
  return generarDias(fechaInicioRenta, fechaAyer)
    .filter(d => getDiaStatus(lecturasEquipo, d) !== 'completo');
}

/**
 * Valida un valor de horómetro de inicio contra las reglas de negocio.
 * Retorna un objeto de error { titulo, mensaje } si no pasa, o null si es válido.
 * Función pura: no produce efectos de UI, el caller decide qué hacer con el resultado.
 */
export function validarInicioHorometro(
  valorNum:         number,
  isFirstReading:   boolean,
  horometroInicial: number | null | undefined,
  lecturasEquipo:   LecturaHorometro[] | null | undefined,
  fechaActiva:      string,
): { titulo: string; mensaje: string } | null {
  const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 1 });

  if (isFirstReading && horometroInicial != null && valorNum <= horometroInicial) {
    return {
      titulo:  'Horómetro inválido',
      mensaje: `El primer registro de inicio (${fmt(valorNum)} hrs) debe ser mayor al horómetro de entrega (${fmt(horometroInicial)} hrs).`,
    };
  }

  const ayer = new Date(fechaActiva + 'T00:00:00');
  ayer.setDate(ayer.getDate() - 1);
  const lecturaAyer = lecturasEquipo?.find(l => l.fecha === localDateOf(ayer));
  if (lecturaAyer?.horometroFin5pm != null && valorNum < lecturaAyer.horometroFin5pm) {
    return {
      titulo:  'Horómetro inválido',
      mensaje: `El horómetro de inicio (${fmt(valorNum)} hrs) no puede ser menor al cierre del día anterior (${fmt(lecturaAyer.horometroFin5pm)} hrs).`,
    };
  }

  return null;
}
