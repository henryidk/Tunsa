import { useEffect, useMemo, useState } from 'react';
import { solicitudesService, type DashboardStats } from '../../services/solicitudes.service';
import { useActivasVencidasSync } from '../../hooks/useActivasVencidasSync';
import type { SolicitudRenta } from '../../types/solicitud-renta.types';
import RentaActivaCard from './RentaActivaCard';
import AmpliacionRentaModal from './AmpliacionRentaModal';
import DevolucionModal from './DevolucionModal';
import DevolucionPesadaModal from '../encargado/DevolucionPesadaModal';
import StatCard from './StatCard';
import FiltroProyectoCombobox from './FiltroProyectoCombobox';
import AsignarProyectoModal from './AsignarProyectoModal';
import { filtrarPorProyecto } from '../../utils/filtrar-por-proyecto';
import { api } from '../../services/auth.service';

interface Props {
  solicitudes:      SolicitudRenta[];
  setSolicitudes:   (s: SolicitudRenta[]) => void;
  updateRenta:      (s: SolicitudRenta) => void;
  removeRenta:      (id: string) => void;
  addVencida:       (s: SolicitudRenta) => void;
  fetchSolicitudes: () => Promise<SolicitudRenta[]>;
  showEncargado?:   boolean;
  showBusqueda?:    boolean;
  initialFolio?:         string;
  initialProyectoId?:    string;
  initialProyectoNombre?: string;
  subtitle?:           string;
  onNavTo?:            (section: string, state?: { solicitudId?: string; folio?: string }) => void;
  canReasignar?:       boolean;
}

export default function RentasActivasSection({
  solicitudes, setSolicitudes, updateRenta, removeRenta, addVencida,
  fetchSolicitudes, showEncargado = false, showBusqueda = false, initialFolio,
  initialProyectoId, initialProyectoNombre, subtitle = 'Equipos actualmente rentados por tus clientes', onNavTo,
  canReasignar = false,
}: Props) {
  const [isLoading,          setIsLoading]          = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [busqueda,           setBusqueda]           = useState(initialFolio ?? '');

  useEffect(() => {
    if (initialFolio) setBusqueda(initialFolio);
  }, [initialFolio]);
  const [abriendo,           setAbriendo]           = useState<string | null>(null);
  const [filtroProyecto,     setFiltroProyecto]     = useState<string | null>(initialProyectoId ?? null);
  const [modalAsignar,       setModalAsignar]       = useState<SolicitudRenta | null>(null);
  const [reasignando,        setReasignando]        = useState<SolicitudRenta | null>(null);
  const [modalAmpliar,       setModalAmpliar]       = useState<SolicitudRenta | null>(null);
  const [modalDevolucion,    setModalDevolucion]    = useState<SolicitudRenta | null>(null);
  const [modalDevPesada,     setModalDevPesada]     = useState<SolicitudRenta | null>(null);
  const [ahora,              setAhora]              = useState(() => Date.now());
  const [pesadaStats,        setPesadaStats]        = useState<Pick<DashboardStats, 'pesadaRecaudadaMes' | 'livianaRecaudadaMes'> | null>(null);
  const [loadingPesadaStats, setLoadingPesadaStats] = useState(true);

  useEffect(() => {
    fetchSolicitudes()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las rentas activas.'))
      .finally(() => setIsLoading(false));
  }, [fetchSolicitudes, setSolicitudes]);

  const refreshStats = () => {
    solicitudesService.getDashboardStats()
      .then(s => setPesadaStats({ pesadaRecaudadaMes: s.pesadaRecaudadaMes, livianaRecaudadaMes: s.livianaRecaudadaMes }))
      .catch(() => setPesadaStats({ pesadaRecaudadaMes: 0, livianaRecaudadaMes: 0 }))
      .finally(() => setLoadingPesadaStats(false));
  };

  useEffect(() => { refreshStats(); }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useActivasVencidasSync(solicitudes, ahora, removeRenta, addVencida);

  const handleVerComprobante = async (id: string) => {
    setAbriendo(id);
    try {
      const { url } = await solicitudesService.getComprobanteUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No se pudo obtener el comprobante. Intenta de nuevo.');
    } finally {
      setAbriendo(null);
    }
  };

  const handleAmpliar = (actualizada: SolicitudRenta) => {
    setModalAmpliar(null);
    updateRenta(actualizada);
  };

  const handleDevolucion = (actualizada: SolicitudRenta) => {
    if (actualizada.estado === 'DEVUELTA') { removeRenta(actualizada.id); refreshStats(); }
    else updateRenta(actualizada);
    setModalDevolucion(null);
  };

  const handleDevolucionPesada = (actualizada: SolicitudRenta) => {
    if (actualizada.estado === 'DEVUELTA') { removeRenta(actualizada.id); refreshStats(); }
    else updateRenta(actualizada);
    setModalDevPesada(null);
  };

  const handleAsignado = (solicitudId: string, proyectoId: string, nombre: string) => {
    updateRenta({ ...solicitudes.find(s => s.id === solicitudId)!, proyecto: { id: proyectoId, nombre } });
    setModalAsignar(null);
  };

  const handleReasignado = async (solicitudId: string, proyectoId: string | null, nombre: string | null) => {
    await api.patch(`/solicitudes/${solicitudId}/proyecto`, { proyectoId });
    const s = solicitudes.find(r => r.id === solicitudId);
    if (s) {
      updateRenta({ ...s, proyecto: proyectoId ? { id: proyectoId, nombre: nombre ?? '' } : null });
    }
    setReasignando(null);
  };

  const { proyectosConRentas, hayIndependientes } = useMemo(() => {
    const map = new Map<string, string>();
    let sinProyecto = false;
    for (const s of solicitudes) {
      if (s.proyecto) map.set(s.proyecto.id, s.proyecto.nombre);
      else            sinProyecto = true;
    }
    return {
      proyectosConRentas: Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre })),
      hayIndependientes:  sinProyecto,
    };
  }, [solicitudes]);

  const solicitudesFiltradas = filtrarPorProyecto(
    (showBusqueda || !!initialFolio) && busqueda.trim()
      ? solicitudes.filter(s => {
          const q = busqueda.toLowerCase().trim();
          return (s.folio ?? '').toLowerCase().includes(q) || s.cliente.nombre.toLowerCase().includes(q);
        })
      : solicitudes,
    filtroProyecto,
  );

  const contratosActivos = solicitudes.length;

  const equiposEnCampo = solicitudes.reduce((sum, s) => {
    const yaDevueltos = new Set(
      (s.devolucionesParciales ?? []).flatMap(d => d.items.map((i: { itemRef: string }) => i.itemRef)),
    );
    return sum + s.items.filter(item => {
      const ref = item.kind === 'maquinaria' || item.kind === 'pesada' ? item.equipoId : item.tipo;
      return !yaDevueltos.has(ref);
    }).length;
  }, 0);

  const pendientesCobrar = solicitudes
    .filter(s => s.esPesada)
    .reduce((sum, s) => sum + s.costoAcumuladoPesada, 0);

  return (
    <div>
      {modalAmpliar && (
        <AmpliacionRentaModal
          solicitud={modalAmpliar}
          onClose={() => setModalAmpliar(null)}
          onAmpliar={handleAmpliar}
        />
      )}
      {modalDevolucion && (
        <DevolucionModal
          solicitud={modalDevolucion}
          onClose={() => setModalDevolucion(null)}
          onDevolucion={handleDevolucion}
        />
      )}
      {modalDevPesada && (
        <DevolucionPesadaModal
          solicitud={modalDevPesada}
          onClose={() => setModalDevPesada(null)}
          onDevolucion={handleDevolucionPesada}
        />
      )}
      {modalAsignar && (
        <AsignarProyectoModal
          solicitud={modalAsignar}
          isOpen={!!modalAsignar}
          onClose={() => setModalAsignar(null)}
          onAsignado={(proyectoId, nombre) => handleAsignado(modalAsignar.id, proyectoId, nombre)}
        />
      )}
      {reasignando && (
        <AsignarProyectoModal
          solicitud={reasignando}
          isOpen={!!reasignando}
          onClose={() => setReasignando(null)}
          onAsignado={(proyectoId, nombre) => handleAsignado(reasignando.id, proyectoId, nombre)}
          proyectoActualId={reasignando.proyecto?.id ?? null}
          onReasignar={(proyectoId, nombre) => handleReasignado(reasignando.id, proyectoId, nombre)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rentas Activas</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Contratos activos"
          value={isLoading ? null : contratosActivos.toString()}
          color="brand"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
        />
        <StatCard
          label="Equipos en campo"
          value={isLoading ? null : equiposEnCampo.toString()}
          color="amber"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          }
        />
        <StatCard
          label="Maq. liviana"
          value={loadingPesadaStats ? null : `Q ${(pesadaStats?.livianaRecaudadaMes ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          color="emerald"
          tag="Recaudado este mes"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <StatCard
          label="Pesada recaudada"
          value={loadingPesadaStats ? null : `Q ${(pesadaStats?.pesadaRecaudadaMes ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          color="emerald"
          tag="Recaudado este mes"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <StatCard
          label="Pesada pendiente"
          value={isLoading ? null : `Q ${pendientesCobrar.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          color="amber"
          tag="Pendientes de cobrar"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        {(showBusqueda || !!initialFolio) && (
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por folio o cliente..."
            className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        )}
        <FiltroProyectoCombobox
          proyectos={proyectosConRentas}
          hayIndependientes={hayIndependientes}
          value={filtroProyecto}
          onChange={setFiltroProyecto}
          fallbackLabel={initialProyectoNombre}
        />
        {initialProyectoId && onNavTo && (
          <button
            onClick={() => onNavTo('proyectos')}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Volver al proyecto
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : solicitudesFiltradas.length === 0 ? (
        <EmptyState hayFiltro={showBusqueda && busqueda.trim().length > 0} />
      ) : (
        <div className="space-y-4">
          {solicitudesFiltradas.map(s => (
            <RentaActivaCard
              key={s.id}
              solicitud={s}
              ahora={ahora}
              abriendo={abriendo === s.id}
              showEncargado={showEncargado}
              onVerComprobante={() => handleVerComprobante(s.id)}
              onAmpliar={() => setModalAmpliar(s)}
              onDevolucion={s.esPesada ? () => setModalDevPesada(s) : () => setModalDevolucion(s)}
              onHorometro={s.esPesada ? () => onNavTo?.('horometros', { solicitudId: s.id }) : undefined}
              onAsignarProyecto={() => setModalAsignar(s)}
              onReasignarProyecto={canReasignar ? () => setReasignando(s) : undefined}
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p className="text-sm font-medium">
        {hayFiltro ? 'Sin resultados para esa búsqueda' : 'Sin rentas activas'}
      </p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        {hayFiltro
          ? 'Intenta con otro folio o nombre de cliente.'
          : 'Cuando un encargado confirme la entrega de una renta, aparecerá aquí.'}
      </p>
    </div>
  );
}
