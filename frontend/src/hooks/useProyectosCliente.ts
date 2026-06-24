import { useState, useEffect } from 'react';
import { proyectosService } from '../services/proyectos.service';
import type { ProyectoResumen } from '../types/proyecto.types';

export function useProyectosCliente(clienteId: string | null) {
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setProyectos([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    proyectosService.getByCliente(clienteId)
      .then(data => { if (!cancelled) setProyectos(data); })
      .catch(()   => { if (!cancelled) setProyectos([]);  })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [clienteId]);

  return { proyectos, loading };
}
