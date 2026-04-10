import { useSolicitudesStore } from '../store/solicitudes.store';

/**
 * Selector para SolicitudesSection.
 * El socket y el fetch viven en useSolicitudesSocket (montado en AdminDashboard).
 */
export function useSolicitudes() {
  const solicitudes = useSolicitudesStore(s => s.solicitudes);
  const isLoading   = useSolicitudesStore(s => s.isLoading);
  const error       = useSolicitudesStore(s => s.error);
  return { solicitudes, isLoading, error };
}
