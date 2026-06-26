import { solicitudesService } from '../../../services/solicitudes.service';
import { useAdminActivasStore } from '../../../store/activas.store';
import { useAdminVencidasStore } from '../../../store/vencidas.store';
import RentasActivasSection from '../../shared/RentasActivasSection';

interface Props {
  onNavTo?:      (section: string, state?: { solicitudId?: string; folio?: string }) => void;
  initialFolio?: string;
}

export default function AdminRentasActivasSection({ onNavTo, initialFolio }: Props) {
  const { solicitudes, setSolicitudes, updateRenta, removeRenta } = useAdminActivasStore();
  const addVencida = useAdminVencidasStore(s => s.addVencida);

  return (
    <RentasActivasSection
      solicitudes={solicitudes}
      setSolicitudes={setSolicitudes}
      updateRenta={updateRenta}
      removeRenta={removeRenta}
      addVencida={addVencida}
      fetchSolicitudes={solicitudesService.getActivas}
      showEncargado
      showBusqueda
      initialFolio={initialFolio}
      subtitle="Todos los contratos de renta en curso"
      onNavTo={onNavTo}
      canReasignar
    />
  );
}
