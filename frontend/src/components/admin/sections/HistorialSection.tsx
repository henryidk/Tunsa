import { solicitudesService } from '../../../services/solicitudes.service';
import HistorialSection from '../../shared/HistorialSection';

interface Props {
  initialProyectoId?:     string;
  initialProyectoNombre?: string;
  onNavTo?:               (section: string, state?: Record<string, string>) => void;
}

export default function AdminHistorialSection({ initialProyectoId, initialProyectoNombre, onNavTo }: Props) {
  return (
    <HistorialSection
      fetchHistorial={solicitudesService.getHistorial}
      showEncargadoFilter
      showEncargado
      initialProyectoId={initialProyectoId}
      initialProyectoNombre={initialProyectoNombre}
      onNavTo={onNavTo}
    />
  );
}
