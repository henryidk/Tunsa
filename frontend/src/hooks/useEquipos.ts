import { useState, useEffect, useCallback } from 'react';
import type { Equipo } from '../types/equipo.types';
import { equiposService } from '../services/equipos.service';

interface UseEquiposResult {
  equipos:      Equipo[];
  isLoading:    boolean;
  error:        string | null;
  refetch:      () => void;
  addEquipo:    (nuevo: Equipo) => void;
  updateEquipo: (updated: Equipo) => void;
}

export function useEquipos(): UseEquiposResult {
  const [equipos, setEquipos]     = useState<Equipo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchEquipos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await equiposService.getAll();
      setEquipos(data);
    } catch {
      setError('No se pudo cargar el inventario de equipos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addEquipo = useCallback((nuevo: Equipo) => {
    setEquipos(prev => [nuevo, ...prev]);
  }, []);

  const updateEquipo = useCallback((updated: Equipo) => {
    setEquipos(prev => prev.map(e => e.id === updated.id ? updated : e));
  }, []);

  useEffect(() => { fetchEquipos(); }, [fetchEquipos]);

  return { equipos, isLoading, error, refetch: fetchEquipos, addEquipo, updateEquipo };
}
