import { useCallback } from 'react';
import EncargadoHorometrosSection from '../../encargado/sections/HorometrosSection';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';

interface Props {
  initialSolicitudId?: string;
}

export default function HorometrosSection({ initialSolicitudId }: Props) {
  const fetchSolicitudes = useCallback(
    (): Promise<SolicitudRenta[]> =>
      Promise.all([
        solicitudesService.getActivas(),
        solicitudesService.getVencidas(),
      ]).then(([activas, vencidas]) =>
        [...activas, ...vencidas].filter(s => s.esPesada),
      ),
    [],
  );

  return (
    <EncargadoHorometrosSection
      initialSolicitudId={initialSolicitudId}
      fetchSolicitudes={fetchSolicitudes}
    />
  );
}
