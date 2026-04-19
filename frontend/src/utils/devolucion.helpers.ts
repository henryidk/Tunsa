import type { SolicitudRenta, DevolucionItemEntry } from '../types/solicitud-renta.types';

/**
 * Resuelve el label legible de un ítem devuelto dado su itemRef y kind,
 * buscando la coincidencia en el snapshot de ítems de la solicitud.
 */
export function resolverLabelItem(
  solicitud:  SolicitudRenta,
  entry:      DevolucionItemEntry,
): string {
  const item = solicitud.items.find(i => {
    if (entry.kind === 'maquinaria') return i.kind === 'maquinaria' && i.equipoId === entry.itemRef;
    return i.kind === 'granel' && i.tipo === entry.itemRef;
  });

  if (!item) return entry.itemRef;

  if (item.kind === 'maquinaria') {
    return `#${item.numeracion} ${item.descripcion}`;
  }
  const label = item.tipoLabel + (item.conMadera ? ' (con madera)' : '');
  return `${item.cantidad.toLocaleString('es-GT')} × ${label}`;
}
