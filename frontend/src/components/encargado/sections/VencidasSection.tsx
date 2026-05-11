import { solicitudesService } from '../../../services/solicitudes.service';
import { useVencidasStore } from '../../../store/vencidas.store';
import { useActivasStore } from '../../../store/activas.store';
import VencidasSection from '../../shared/VencidasSection';

type NavTo = (section: string, state?: { solicitudId?: string; folio?: string }) => void;

interface Props {
  initialFolio?: string;
  onNavTo?:      NavTo;
}

export default function EncargadoVencidasSection({ initialFolio, onNavTo }: Props) {
  const { solicitudes, setSolicitudes, removeRenta, updateRenta } = useVencidasStore();
  const addActiva = useActivasStore(s => s.addRenta);

  return (
    <VencidasSection
      solicitudes={solicitudes}
      setSolicitudes={setSolicitudes}
      updateRenta={updateRenta}
      removeRenta={removeRenta}
      addActiva={addActiva}
      fetchSolicitudes={solicitudesService.getVencidasMias}
      initialFolio={initialFolio}
      onNavTo={onNavTo}
      emptyStateText="Todas tus rentas están dentro de plazo."
    />
  );
}
