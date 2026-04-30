import { solicitudesService } from '../../../services/solicitudes.service';
import { useAdminActivasStore } from '../../../store/activas.store';
import { useAdminVencidasStore } from '../../../store/vencidas.store';
import RentasActivasSection from '../../shared/RentasActivasSection';

interface Props {
  onNavTo?: (section: string, state?: { solicitudId?: string }) => void;
}

export default function AdminRentasActivasSection({ onNavTo }: Props) {
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
      subtitle="Todos los contratos de renta en curso"
      onNavTo={onNavTo}
    />
  );
}
