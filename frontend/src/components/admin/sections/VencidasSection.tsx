import { solicitudesService } from '../../../services/solicitudes.service';
import { useAdminVencidasStore } from '../../../store/vencidas.store';
import { useAdminActivasStore } from '../../../store/activas.store';
import VencidasSection from '../../shared/VencidasSection';

type NavTo = (section: string, state?: { solicitudId?: string; folio?: string }) => void;

interface Props {
  initialFolio?: string;
  onNavTo?:      NavTo;
}

export default function AdminVencidasSection({ initialFolio, onNavTo }: Props) {
  const { solicitudes, setSolicitudes, removeRenta, updateRenta } = useAdminVencidasStore();
  const addActiva = useAdminActivasStore(s => s.addRenta);

  return (
    <VencidasSection
      solicitudes={solicitudes}
      setSolicitudes={setSolicitudes}
      updateRenta={updateRenta}
      removeRenta={removeRenta}
      addActiva={addActiva}
      fetchSolicitudes={solicitudesService.getVencidas}
      showEncargado
      initialFolio={initialFolio}
      onNavTo={onNavTo}
    />
  );
}
