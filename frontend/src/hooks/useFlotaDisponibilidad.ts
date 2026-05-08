import { useState, useEffect, useCallback } from 'react';
import { equiposService } from '../services/equipos.service';
import type { FlotaItem } from '../types/flota.types';

interface UseFlotaDisponibilidadResult {
  items:     FlotaItem[];
  isLoading: boolean;
  error:     string | null;
  refresh:   () => void;
}

export function useFlotaDisponibilidad(): UseFlotaDisponibilidadResult {
  const [items,     setItems]     = useState<FlotaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    equiposService.getDisponibilidad()
      .then(setItems)
      .catch(() => setError('No se pudo cargar la disponibilidad de flota.'))
      .finally(() => setIsLoading(false));
  }, [tick]);

  return { items, isLoading, error, refresh };
}
