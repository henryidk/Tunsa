/**
 * Cálculo de recargo por atraso en devolución.
 *
 * Reglas de negocio:
 *  - El cliente tiene 1 hora de gracia después del vencimiento para devolver sin cargo.
 *  - Pasada la gracia, se cobra 1 día adicional por equipo por cada fracción de 24 h de atraso.
 *  - Aplica a todos los ítems de la renta individualmente.
 */

/** Milisegundos de gracia antes de que empiece a correr el cargo adicional. */
export const GRACE_MS = 3_600_000; // 1 hora

type UnidadDuracion = 'dias' | 'semanas' | 'meses';

/** Calcula la fecha de vencimiento de un ítem a partir del inicio de la renta. */
export function calcularFinItem(
  fechaInicio: Date,
  duracion:    number,
  unidad:      string,
): Date {
  const u = unidad as UnidadDuracion;
  if (u === 'dias')    return new Date(fechaInicio.getTime() + duracion * 86_400_000);
  if (u === 'semanas') return new Date(fechaInicio.getTime() + duracion * 7 * 86_400_000);
  return new Date(fechaInicio.getTime() + duracion * 30 * 86_400_000);
}

/**
 * Calcula la fecha de vencimiento más temprana entre todos los ítems.
 * Este valor se guarda en `fechaFinEstimada` al confirmar la entrega.
 */
export function calcularFechaFinEstimada(
  fechaInicio: Date,
  items:       Array<{ duracion: number; unidad: string }>,
): Date {
  const fins = items.map(i => calcularFinItem(fechaInicio, i.duracion, i.unidad).getTime());
  return new Date(Math.min(...fins));
}

/**
 * Calcula el recargo de un ítem individual dado el momento real de devolución.
 * Devuelve 0 si la devolución ocurre dentro de la hora de gracia.
 */
export function calcularRecargoItem(
  tarifa:          number,
  fechaVencimiento: Date,
  fechaDevolucion:  Date,
): number {
  const excesoMs = fechaDevolucion.getTime() - fechaVencimiento.getTime() - GRACE_MS;
  if (excesoMs <= 0) return 0;
  return Math.ceil(excesoMs / 86_400_000) * tarifa;
}

/**
 * Calcula el recargo total sumando el de cada ítem.
 * Los ítems sin tarifa (null) no generan recargo.
 */
export function calcularRecargoTotal(
  items:           Array<{ duracion: number; unidad: string; tarifa: number | null }>,
  fechaInicio:     Date,
  fechaDevolucion: Date,
): number {
  return items.reduce((suma, item) => {
    if (item.tarifa === null) return suma;
    const fin = calcularFinItem(fechaInicio, item.duracion, item.unidad);
    return suma + calcularRecargoItem(item.tarifa, fin, fechaDevolucion);
  }, 0);
}
