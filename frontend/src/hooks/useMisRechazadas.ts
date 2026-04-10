import { useState, useEffect, useCallback } from 'react';
import { solicitudesService } from '../services/solicitudes.service';
import { useRechazadasStore } from '../store/rechazadas.store';

interface UseMisRechazadasReturn {
  solicitudes: ReturnType<typeof useRechazadasStore.getState>['solicitudes'];
  isLoading:   boolean;
  error:       string | null;
  refetch:     () => void;
}

/**
 * Carga el historial de solicitudes RECHAZADA del encargado autenticado.
 * Usa `rechazadas.store` como fuente de verdad, de modo que los eventos
 * en tiempo real (addRechazada desde useEncargadoSocket) se reflejan
 * automáticamente en la UI sin recargar.
 */
export function useMisRechazadas(): UseMisRechazadasReturn {
  const solicitudes    = useRechazadasStore(s => s.solicitudes);
  const setSolicitudes = useRechazadasStore(s => s.setSolicitudes);

  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await solicitudesService.getMiasHistorial();
      setSolicitudes(data);
    } catch {
      setError('No se pudo cargar el historial de solicitudes rechazadas.');
    } finally {
      setIsLoading(false);
    }
  }, [setSolicitudes]);

  useEffect(() => { cargar(); }, [cargar]);

  return { solicitudes, isLoading, error, refetch: cargar };
}
