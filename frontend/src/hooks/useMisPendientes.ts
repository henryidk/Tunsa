import { useState, useEffect, useCallback, useRef } from 'react';
import { solicitudesService } from '../services/solicitudes.service';
import { usePendientesStore } from '../store/pendientes.store';

const POLL_INTERVAL_MS = 30_000;

/**
 * Carga y refresca las solicitudes PENDIENTE del encargado.
 * Escribe en `usePendientesStore` para que `useEncargadoSocket` pueda
 * eliminar solicitudes en tiempo real sin recargar.
 */
export function useMisPendientes() {
  const { solicitudes, setSolicitudes } = usePendientesStore();
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const cargar = useCallback(async (silencioso = false) => {
    if (silencioso) setIsRefreshing(true);
    try {
      const data = await solicitudesService.getMias();
      if (!mountedRef.current) return;
      setSolicitudes(data);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError('No se pudieron cargar tus solicitudes pendientes.');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [setSolicitudes]);

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // Polling automático — sincroniza con aprobaciones/rechazos no recibidos por socket
  useEffect(() => {
    const id = setInterval(() => cargar(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cargar]);

  const refetch = useCallback(() => cargar(true), [cargar]);

  return { solicitudes, isLoading, isRefreshing, error, refetch };
}
