import type { ItemSnapshot, ExtensionEntry, UnidadDuracion } from '../types/solicitud-renta.types';

export type NivelUrgencia = 'vencido' | 'critico' | 'proximo' | 'ok';

export const URGENCIA_BADGE: Record<NivelUrgencia, string> = {
  vencido: 'bg-slate-800 text-white',
  critico: 'bg-red-100 text-red-700 border border-red-200',
  proximo: 'bg-amber-100 text-amber-700 border border-amber-200',
  ok:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

export const URGENCIA_BORDER: Record<NivelUrgencia, string> = {
  vencido: 'border-l-slate-600',
  critico: 'border-l-red-400',
  proximo: 'border-l-amber-400',
  ok:      'border-l-indigo-400',
};

export function calcularFin(inicio: Date, duracion: number, unidad: UnidadDuracion): Date {
  if (unidad === 'horas')   return new Date(inicio.getTime() + duracion * 3_600_000);
  if (unidad === 'dias')    return new Date(inicio.getTime() + duracion * 86_400_000);
  if (unidad === 'semanas') return new Date(inicio.getTime() + duracion * 7 * 86_400_000);
  return new Date(inicio.getTime() + duracion * 30 * 86_400_000);
}

export function calcularFinConExtensiones(
  inicio:      Date,
  item:        ItemSnapshot,
  extensiones: ExtensionEntry[],
): Date {
  const ref  = item.kind === 'maquinaria' ? item.equipoId : item.tipo;
  const exts = extensiones.filter(e => e.itemRef === ref);
  let fin = calcularFin(inicio, item.duracion, item.unidad);
  for (const ext of exts) fin = calcularFin(fin, ext.duracion, ext.unidad);
  return fin;
}

export function msRestantes(
  inicio:      Date,
  item:        ItemSnapshot,
  extensiones: ExtensionEntry[],
  ahora:       number,
): number {
  return calcularFinConExtensiones(inicio, item, extensiones).getTime() - ahora;
}

export function msMinimos(
  items:       ItemSnapshot[],
  inicio:      Date,
  extensiones: ExtensionEntry[],
  ahora:       number,
): number {
  if (items.length === 0) return Infinity;
  return Math.min(...items.map(i => msRestantes(inicio, i, extensiones, ahora)));
}

export function nivelUrgencia(ms: number): NivelUrgencia {
  if (ms <= 0)              return 'vencido';
  if (ms < 24 * 3_600_000) return 'critico';
  if (ms <= 72 * 3_600_000) return 'proximo';
  return 'ok';
}

/**
 * Mismo día que inicio → muestra la duración total en días enteros.
 * Días posteriores      → desglose días + horas restantes.
 * < 24 h               → "Xh Ym".
 * Vencida              → "Vencida".
 */
export function formatTiempoRestante(ms: number, fechaInicio: Date, ahoraTs: number): string {
  if (ms <= 0) return 'Vencida';

  const ahora   = new Date(ahoraTs);
  const mismoDia =
    fechaInicio.getFullYear() === ahora.getFullYear() &&
    fechaInicio.getMonth()    === ahora.getMonth()    &&
    fechaInicio.getDate()     === ahora.getDate();

  if (mismoDia) {
    const totalDias = Math.round((ms + ahoraTs - fechaInicio.getTime()) / 86_400_000);
    return `${totalDias} ${totalDias === 1 ? 'día' : 'días'}`;
  }

  const dias  = Math.floor(ms / 86_400_000);
  const horas = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins  = Math.floor((ms % 3_600_000)  / 60_000);

  if (dias >= 1) return horas > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'} ${horas} h` : `${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (horas >= 1) return mins > 0 ? `${horas} h ${mins} min` : `${horas} h`;
  return `${mins} min`;
}
