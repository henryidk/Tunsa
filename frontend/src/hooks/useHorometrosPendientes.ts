import { useEffect } from 'react';
import { useAdminActivasStore } from '../store/activas.store';
import { solicitudesService } from '../services/solicitudes.service';
import { today } from '../utils/horometro.utils';

export function useHorometrosPendientes(): number {
  const solicitudes = useAdminActivasStore(s => s.solicitudes);

  useEffect(() => {
    solicitudesService.getActivas()
      .then(data => useAdminActivasStore.getState().setSolicitudes(data))
      .catch(() => {});
  }, []);

  const hoy = today();
  return solicitudes.filter(s => {
    if (!s.esPesada) return false;
    const ul = s.ultimaLectura;
    return !ul || ul.fecha !== hoy || !ul.completa;
  }).length;
}
