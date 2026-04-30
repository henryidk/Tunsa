import { solicitudesService } from '../../../services/solicitudes.service';
import { useActivasStore } from '../../../store/activas.store';
import { useVencidasStore } from '../../../store/vencidas.store';
import RentasActivasSection from '../../shared/RentasActivasSection';

interface Props {
  onNavTo?: (section: string, state?: { solicitudId?: string }) => void;
}

export default function EncargadoRentasActivasSection({ onNavTo }: Props) {
  const { solicitudes, setSolicitudes, updateRenta, removeRenta } = useActivasStore();
  const addVencida = useVencidasStore(s => s.addVencida);

  return (
    <RentasActivasSection
      solicitudes={solicitudes}
      setSolicitudes={setSolicitudes}
      updateRenta={updateRenta}
      removeRenta={removeRenta}
      addVencida={addVencida}
      fetchSolicitudes={solicitudesService.getActivasMias}
      subtitle="Equipos actualmente rentados por tus clientes"
      onNavTo={onNavTo}
    />
  );
}
