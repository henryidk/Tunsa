import { useState, useEffect, useCallback, useRef } from 'react';
import { solicitudesService } from '../services/solicitudes.service';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

const POLL_INTERVAL_MS = 30_000;

export function useMisPendientes() {
  const [solicitudes, setSolicitudes] = useState<SolicitudRenta[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
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
  }, []);

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // Polling automático para reflejar aprobaciones/rechazos del admin
  useEffect(() => {
    const id = setInterval(() => cargar(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cargar]);

  const refetch = useCallback(() => cargar(true), [cargar]);

  return { solicitudes, isLoading, isRefreshing, error, refetch };
}
