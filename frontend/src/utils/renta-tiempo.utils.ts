import type { SolicitudRenta, ItemSnapshot, ExtensionEntry, UnidadDuracion } from '../types/solicitud-renta.types';

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
  // meses: calendario real — 29/X + 1 mes = 29/(X+1), clampeado al último día si el mes es más corto
  const tgtMonth  = inicio.getUTCMonth() + duracion;
  const tgtYear   = inicio.getUTCFullYear() + Math.floor(tgtMonth / 12);
  const normMonth = ((tgtMonth % 12) + 12) % 12;
  const lastDay   = new Date(Date.UTC(tgtYear, normMonth + 1, 0)).getUTCDate();
  const tgtDay    = Math.min(inicio.getUTCDate(), lastDay);
  return new Date(Date.UTC(tgtYear, normMonth, tgtDay,
    inicio.getUTCHours(), inicio.getUTCMinutes(), inicio.getUTCSeconds(), inicio.getUTCMilliseconds()));
}

function duracionEnMs(duracion: number, unidad: UnidadDuracion): number {
  if (unidad === 'horas')   return duracion * 3_600_000;
  if (unidad === 'dias')    return duracion * 86_400_000;
  if (unidad === 'semanas') return duracion * 7 * 86_400_000;
  return duracion * 30 * 86_400_000;
}

/**
 * Fecha de vencimiento efectiva de un ítem = duración original + ampliaciones pagadas.
 * Las extensiones de gracia NO se incluyen: son ventana de entrega, no extensión de renta.
 */
export function calcularFinConExtensiones(
  inicio:      Date,
  item:        ItemSnapshot,
  extensiones: ExtensionEntry[],
): Date {
  const ref  = item.kind === 'maquinaria' || item.kind === 'pesada'
    ? item.equipoId
    : item.tipo;
  const exts = extensiones.filter(e => e.itemRef === ref && e.tipo !== 'gracia');
  const dur  = item.kind === 'pesada' ? item.diasSolicitados : (item.duracion ?? 0);
  const uni  = item.kind === 'pesada' ? 'dias' : (item.unidad ?? 'dias');
  let fin = calcularFin(inicio, dur, uni as UnidadDuracion);
  for (const ext of exts) fin = calcularFin(fin, ext.duracion, ext.unidad);
  return fin;
}

/**
 * Ventana total de entrega en ms: 1h automática + extensiones de gracia acumuladas.
 * Usar en lugar de GRACE_MS para mostrar el badge "En gracia" y calcular el atraso visible.
 */
export function calcularVentanaGracia(extensiones: ExtensionEntry[]): number {
  const gracias = extensiones.filter(e => e.tipo === 'gracia');
  if (gracias.length === 0) return GRACE_MS;
  // Suma por ítem (múltiples aplicaciones acumulan), luego máximo entre ítems
  const sumByItem = new Map<string, number>();
  for (const e of gracias) {
    const ms = duracionEnMs(e.duracion, e.unidad as UnidadDuracion);
    sumByItem.set(e.itemRef, (sumByItem.get(e.itemRef) ?? 0) + ms);
  }
  const maxExtraMs = Math.max(...sumByItem.values());
  return GRACE_MS + maxExtraMs;
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

// ── Helpers exclusivos de rentas vencidas ────────────────────────────────────

export const GRACE_MS = 3_600_000; // 1 hora de gracia antes de que corran cargos
const DAY_MS   = 86_400_000;

/** Fecha de vencimiento más próxima entre todos los ítems de una renta. */
export function calcularFinEstimado(
  items:       ItemSnapshot[],
  inicio:      Date,
  extensiones: ExtensionEntry[],
): Date {
  const fins = items.map(i => calcularFinConExtensiones(inicio, i, extensiones).getTime());
  return new Date(Math.min(...fins));
}

/** Recargo de un ítem individual en el instante `ahora`. */
export function calcularRecargoItem(tarifa: number, finItem: Date, ahora: number): number {
  const excesoMs = ahora - finItem.getTime() - GRACE_MS;
  if (excesoMs <= 0) return 0;
  return Math.ceil(excesoMs / DAY_MS) * tarifa;
}

/** Recargo total proyectado al instante `ahora`, sumando todos los ítems con tarifa. */
export function calcularRecargoActual(
  items:       ItemSnapshot[],
  inicio:      Date,
  ahora:       number,
  extensiones: ExtensionEntry[],
): number {
  return items.reduce((suma, item) => {
    const tarifa   = (item as { tarifa?: number | null }).tarifa ?? null;
    if (tarifa === null) return suma;
    const cantidad = item.kind === 'granel' ? item.cantidad : 1;
    const fin      = calcularFinConExtensiones(inicio, item, extensiones);
    return suma + calcularRecargoItem(tarifa, fin, ahora) * cantidad;
  }, 0);
}

/** Penalización por entrega tardía de maquinaria pesada (5 hrs mín. por equipo). */
export function calcularRecargoPesada(
  items:            ItemSnapshot[],
  fechaFinEstimada: Date,
  ahora:            number,
  ventanaGracia    = GRACE_MS,
): number {
  if (ahora - fechaFinEstimada.getTime() <= ventanaGracia) return 0;
  return items
    .filter((i): i is Extract<ItemSnapshot, { kind: 'pesada' }> => i.kind === 'pesada')
    .reduce((sum, item) => sum + item.tarifaEfectiva * 5, 0);
}

/** Milisegundos de atraso respecto al vencimiento (negativo = dentro de gracia). */
export function msAtraso(fechaVencimiento: Date, ahora: number): number {
  return ahora - fechaVencimiento.getTime();
}

/**
 * Momento exacto en que cambiará el recargo para una renta.
 * - Dentro de gracia → cambia cuando termina la gracia.
 * - Pasada la gracia → siguiente múltiplo de 24h desde el fin de la gracia.
 */
export function proximoCambioRecargo(vencimiento: Date, ahora: number): number {
  const graceEnd = vencimiento.getTime() + GRACE_MS;
  if (ahora < graceEnd) return graceEnd;
  const excesoMs = ahora - graceEnd;
  return graceEnd + Math.ceil(excesoMs / DAY_MS) * DAY_MS;
}

/** Próximo cambio de recargo entre todas las rentas de la lista. */
export function proximoCambioGlobal(solicitudes: SolicitudRenta[], ahora: number): number {
  return solicitudes.reduce((min, s) => {
    const inicio      = s.fechaInicioRenta ? new Date(s.fechaInicioRenta) : new Date();
    const extensiones = s.extensiones ?? [];
    const vencimiento = s.fechaFinEstimada
      ? new Date(s.fechaFinEstimada)
      : calcularFinEstimado(s.items, inicio, extensiones);
    return Math.min(min, proximoCambioRecargo(vencimiento, ahora));
  }, Infinity);
}

/**
 * Tiempo restante dentro de la ventana de gracia, en formato legible.
 * Usa notación monospace-friendly: "45m 23s", "5m 02s", "23s".
 */
export function formatGraciaRestante(ms: number): string {
  const totalSeg = Math.max(0, Math.ceil(ms / 1000));
  const mins     = Math.floor(totalSeg / 60);
  const segs     = totalSeg % 60;
  if (mins >= 60) {
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  if (mins > 0) return `${mins}m ${String(segs).padStart(2, '0')}s`;
  return `${segs}s`;
}

export function formatAtraso(ms: number, ventanaGracia = GRACE_MS): string {
  if (ms <= ventanaGracia) return 'En gracia';
  const totalMin = Math.floor((ms - ventanaGracia) / 60_000);
  const horas    = Math.floor(totalMin / 60);
  if (horas < 24) return `${horas}h ${totalMin % 60}min`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}

// ── Helpers de tiempo restante (rentas activas) ───────────────────────────────

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
