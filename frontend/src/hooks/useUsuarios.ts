import { useState, useEffect, useCallback } from 'react';
import type { Usuario } from '../types/auth.types';
import { usuariosService } from '../services/usuarios.service';

interface UseUsuariosResult {
  usuarios: Usuario[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addUsuario: (nuevo: Usuario) => void;
  updateUsuario: (updated: Usuario) => void;
}

export function useUsuarios(): UseUsuariosResult {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await usuariosService.getAll();
      setUsuarios(data);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addUsuario = useCallback((nuevo: Usuario) => {
    setUsuarios(prev => [...prev, nuevo]);
  }, []);

  const updateUsuario = useCallback((updated: Usuario) => {
    setUsuarios(prev => prev.map(u => u.id === updated.id ? updated : u));
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  return { usuarios, isLoading, error, refetch: fetchUsuarios, addUsuario, updateUsuario };
}
