import { useEffect, useState } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import { useAdminVencidasStore } from '../../../store/vencidas.store';
import { useAdminActivasStore } from '../../../store/activas.store';
import { useVencidasRecargoTick } from '../../../hooks/useVencidasRecargoTick';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';
import { calcularRecargoActual } from '../../../utils/renta-tiempo.utils';
import RentaVencidaCard from '../../shared/RentaVencidaCard';
import AmpliacionRentaModal from '../../shared/AmpliacionRentaModal';
import TiempoGraciaModal from '../../shared/TiempoGraciaModal';
import DevolucionModal from '../../shared/DevolucionModal';
import StatCard from '../../shared/StatCard';

export default function VencidasSection() {
  const { solicitudes, setSolicitudes, removeRenta, updateRenta } = useAdminVencidasStore();

  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [busqueda,        setBusqueda]        = useState('');
  const [ahora,           setAhora]           = useState(() => Date.now());
  const [abriendo,        setAbriendo]        = useState<string | null>(null);
  const [modalAmpliar,    setModalAmpliar]    = useState<SolicitudRenta | null>(null);
  const [modalGracia,     setModalGracia]     = useState<SolicitudRenta | null>(null);
  const [modalDevolucion, setModalDevolucion] = useState<SolicitudRenta | null>(null);

  const ahoraRecargo = useVencidasRecargoTick(solicitudes);

  useEffect(() => {
    solicitudesService.getVencidas()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las rentas vencidas.'))
      .finally(() => setIsLoading(false));
  }, [setSolicitudes]);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const transicionarTrasExtension = (actualizada: SolicitudRenta) => {
    const nuevaFin = actualizada.fechaFinEstimada ? new Date(actualizada.fechaFinEstimada).getTime() : 0;
    if (nuevaFin > Date.now()) {
      removeRenta(actualizada.id);
      useAdminActivasStore.getState().addRenta(actualizada);
    } else {
      updateRenta(actualizada);
    }
  };

  const handleAmpliar = (actualizada: SolicitudRenta) => {
    setModalAmpliar(null);
    transicionarTrasExtension(actualizada);
  };

  const handleGracia = (actualizada: SolicitudRenta) => {
    setModalGracia(null);
    transicionarTrasExtension(actualizada);
  };

  const handleDevolucion = (actualizada: SolicitudRenta) => {
    setModalDevolucion(null);
    if (actualizada.estado === 'DEVUELTA') removeRenta(actualizada.id);
    else transicionarTrasExtension(actualizada);
  };

  const handleVerComprobante = async (id: string) => {
    setAbriendo(id);
    try {
      const { url } = await solicitudesService.getComprobanteUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No se pudo obtener el comprobante.');
    } finally {
      setAbriendo(null);
    }
  };

  const solicitudesFiltradas = busqueda.trim()
    ? solicitudes.filter(s => s.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()))
    : solicitudes;

  const totalRecargo = solicitudes.reduce((suma, s) => {
    const inicio      = s.fechaInicioRenta ? new Date(s.fechaInicioRenta) : new Date();
    const extensiones = s.extensiones ?? [];
    return suma + calcularRecargoActual(s.items, inicio, ahoraRecargo, extensiones);
  }, 0);

  const equiposPendientes = solicitudes.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div>
      {modalAmpliar && (
        <AmpliacionRentaModal solicitud={modalAmpliar} onClose={() => setModalAmpliar(null)} onAmpliar={handleAmpliar} />
      )}
      {modalGracia && (
        <TiempoGraciaModal solicitud={modalGracia} onClose={() => setModalGracia(null)} onGracia={handleGracia} />
      )}
      {modalDevolucion && (
        <DevolucionModal solicitud={modalDevolucion} onClose={() => setModalDevolucion(null)} onDevolucion={handleDevolucion} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rentas Vencidas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Equipos cuya fecha de devolución ya pasó — el cliente tiene 1 h de gracia antes de que corran cargos adicionales
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Contratos vencidos"
          value={isLoading ? null : solicitudes.length.toString()}
          color="red"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          label="Equipos pendientes"
          value={isLoading ? null : equiposPendientes.toString()}
          color="amber"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
        />
        <StatCard
          label="Recargo acumulado"
          value={isLoading ? null : `Q ${totalRecargo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          color="orange"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : solicitudesFiltradas.length === 0 ? (
        <EmptyState hayFiltro={busqueda.trim().length > 0} />
      ) : (
        <div className="space-y-4">
          {solicitudesFiltradas.map(s => (
            <RentaVencidaCard
              key={s.id}
              solicitud={s}
              ahora={ahora}
              ahoraRecargo={ahoraRecargo}
              abriendo={abriendo === s.id}
              showEncargado
              onVerComprobante={() => handleVerComprobante(s.id)}
              onAmpliar={() => setModalAmpliar(s)}
              onGracia={() => setModalGracia(s)}
              onDevolucion={() => setModalDevolucion(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hayFiltro }: { hayFiltro: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <p className="text-sm font-medium">
        {hayFiltro ? 'Sin resultados para esa búsqueda' : 'Sin rentas vencidas'}
      </p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        {hayFiltro
          ? 'Intenta con otro nombre de cliente.'
          : 'Todas las rentas activas están dentro de plazo.'}
      </p>
    </div>
  );
}
