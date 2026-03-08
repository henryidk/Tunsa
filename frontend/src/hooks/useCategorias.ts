import { useState, useEffect } from 'react';
import { categoriasService } from '../services/categorias.service';

interface UseCategorias {
  categorias: string[];
  isLoading:  boolean;
}

export function useCategorias(): UseCategorias {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    categoriasService.getAll()
      .then(data => setCategorias(data))
      .catch(() => setCategorias([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { categorias, isLoading };
}
