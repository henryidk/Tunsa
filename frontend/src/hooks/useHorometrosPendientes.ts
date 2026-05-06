import { useEffect } from 'react';
import { useAdminActivasStore } from '../store/activas.store';
import { solicitudesService } from '../services/solicitudes.service';

export function useHorometrosPendientes(): number {
  const solicitudes = useAdminActivasStore(s => s.solicitudes);

  useEffect(() => {
    solicitudesService.getActivas()
      .then(data => useAdminActivasStore.getState().setSolicitudes(data))
      .catch(() => {});
  }, []);

  const hoy = new Date().toISOString().substring(0, 10);
  return solicitudes.filter(s => {
    if (!s.esPesada) return false;
    const ul = s.ultimaLectura;
    return !ul || ul.fecha !== hoy || !ul.completa;
  }).length;
}
