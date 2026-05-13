import { useCallback } from 'react';
import EncargadoHorometrosSection from '../../encargado/sections/HorometrosSection';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';

interface Props {
  initialSolicitudId?: string;
  onNavTo?:            (section: string, state?: { solicitudId?: string; folio?: string }) => void;
}

export default function HorometrosSection({ initialSolicitudId, onNavTo }: Props) {
  const fetchSolicitudes = useCallback(
    (): Promise<SolicitudRenta[]> =>
      Promise.all([
        solicitudesService.getActivas(),
        solicitudesService.getVencidas(),
      ]).then(([activas, vencidas]) =>
        [...new Map([...activas, ...vencidas].map(s => [s.id, s])).values()]
          .filter(s => s.esPesada),
      ),
    [],
  );

  return (
    <EncargadoHorometrosSection
      initialSolicitudId={initialSolicitudId}
      fetchSolicitudes={fetchSolicitudes}
      onNavTo={onNavTo}
    />
  );
}
