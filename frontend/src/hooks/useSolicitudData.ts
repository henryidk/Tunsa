import { useState, useEffect, useCallback } from 'react';
import type { Equipo } from '../types/equipo.types';
import type { TipoGranel, GranelResponse } from '../services/granel.service';
import { equiposService } from '../services/equipos.service';
import { granelService } from '../services/granel.service';
import { solicitudesService } from '../services/solicitudes.service';
import { useReservadosStore } from '../store/reservados.store';

interface SolicitudData {
  equiposLiviana:      Equipo[];
  granelData:          Partial<Record<TipoGranel, GranelResponse>>;
  reservedIds:         Set<string>;
  isLoading:           boolean;
  error:               string | null;
  refreshReservedIds:  () => Promise<void>;
}

export function useSolicitudData(): SolicitudData {
  const [equiposLiviana, setEquiposLiviana] = useState<Equipo[]>([]);
  const [granelData,     setGranelData]     = useState<Partial<Record<TipoGranel, GranelResponse>>>({});
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const { reservedIds, setAll } = useReservadosStore();

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
        setAll(reservados);
      })
      .catch(() => setError('No se pudo cargar el inventario. Recarga la página.'))
      .finally(() => setIsLoading(false));
  }, []);

  const refreshReservedIds = useCallback(async () => {
    try {
      const reservados = await solicitudesService.getEquiposReservados();
      setAll(reservados);
    } catch {
      // fallo silencioso — el backend rechazará conflictos al intentar enviar
    }
  }, [setAll]);

  return { equiposLiviana, granelData, reservedIds, isLoading, error, refreshReservedIds };
}
