import { useState, useEffect } from 'react';
import type { Equipo } from '../types/equipo.types';
import type { TipoGranel, GranelResponse } from '../services/granel.service';
import { equiposService } from '../services/equipos.service';
import { granelService } from '../services/granel.service';
import { solicitudesService } from '../services/solicitudes.service';

interface SolicitudData {
  equiposLiviana: Equipo[];
  granelData:     Partial<Record<TipoGranel, GranelResponse>>;
  reservedIds:    Set<string>;
  isLoading:      boolean;
  error:          string | null;
}

export function useSolicitudData(): SolicitudData {
  const [equiposLiviana, setEquiposLiviana] = useState<Equipo[]>([]);
  const [granelData,     setGranelData]     = useState<Partial<Record<TipoGranel, GranelResponse>>>({});
  const [reservedIds,    setReservedIds]    = useState<Set<string>>(new Set());
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      equiposService.getAll(),
      granelService.getAll('PUNTAL'),
      granelService.getAll('ANDAMIO_SIMPLE'),
      granelService.getAll('ANDAMIO_RUEDAS'),
      solicitudesService.getEquiposReservados(),
    ])
      .then(([equipos, puntal, simple, ruedas, reservados]) => {
        setEquiposLiviana(equipos.filter(e => e.isActive && e.tipo.nombre === 'LIVIANA'));
        setGranelData({ PUNTAL: puntal, ANDAMIO_SIMPLE: simple, ANDAMIO_RUEDAS: ruedas });
        setReservedIds(new Set(reservados));
      })
      .catch(() => setError('No se pudo cargar el inventario. Recarga la página.'))
      .finally(() => setIsLoading(false));
  }, []);

  return { equiposLiviana, granelData, reservedIds, isLoading, error };
}
