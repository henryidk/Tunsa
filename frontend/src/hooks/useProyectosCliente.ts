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

    proyectosService.getMisProyectos()
      .then(data => {
        if (!cancelled) setProyectos(data.filter(p => p.clienteId === clienteId));
      })
      .catch(()   => { if (!cancelled) setProyectos([]);  })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [clienteId]);

  return { proyectos, loading };
}
