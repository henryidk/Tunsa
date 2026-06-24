import type { SolicitudRenta } from '../types/solicitud-renta.types';

export function filtrarPorProyecto(
  solicitudes: SolicitudRenta[],
  filtro: string | null,
): SolicitudRenta[] {
  if (filtro === null) return solicitudes;
  if (filtro === '')   return solicitudes.filter(s => !s.proyecto);
  return solicitudes.filter(s => s.proyecto?.id === filtro);
}
