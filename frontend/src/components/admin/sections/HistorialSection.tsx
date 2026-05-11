import { solicitudesService } from '../../../services/solicitudes.service';
import HistorialSection from '../../shared/HistorialSection';

export default function AdminHistorialSection() {
  return (
    <HistorialSection
      fetchHistorial={solicitudesService.getHistorial}
      showEncargadoFilter
      showEncargado
    />
  );
}
