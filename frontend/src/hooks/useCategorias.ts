import { useState, useEffect, useCallback } from 'react';
import { categoriasService } from '../services/categorias.service';
import type { TipoConCategorias } from '../types/equipo.types';

interface UseCategorias {
  tipos:     TipoConCategorias[];
  isLoading: boolean;
  refetch:   () => void;
}

export function useCategorias(): UseCategorias {
  const [tipos, setTipos]         = useState<TipoConCategorias[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    categoriasService.getTipos()
      .then(data => setTipos(data))
      .catch(() => setTipos([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { tipos, isLoading, refetch };
}
