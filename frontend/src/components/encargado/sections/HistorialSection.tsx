import { solicitudesService } from '../../../services/solicitudes.service';
import HistorialSection from '../../shared/HistorialSection';

export default function EncargadoHistorialSection() {
  return (
    <HistorialSection
      fetchHistorial={solicitudesService.getMiasHistorial}
    />
  );
}
