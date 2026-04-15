import { useState } from 'react';
import type { UseMisPendientesReturn } from '../../../hooks/useMisPendientes';
import { useRechazadasStore } from '../../../store/rechazadas.store';
import MisRechazadasTab from './MisRechazadasTab';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../../types/solicitud.types';

type Tab = 'espera' | 'rechazadas';

interface Props {
  onNavTo?:       (section: string) => void;
  misPendientes:  UseMisPendientesReturn;
}

export default function MisSolicitudesSection({ onNavTo, misPendientes }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('espera');

  const { solicitudes: pendientes, isLoading: loadingP, isRefreshing, error: errorP, refetch: refetchP } = misPendientes;

  // Solo el conteo para el badge — selector primitivo, sin crear nuevos arrays
  const rechazadasCount = useRechazadasStore(s => s.solicitudes.length);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis Solicitudes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Historial de tus solicitudes de renta enviadas
          </p>
        </div>
        {activeTab === 'espera' && (
          <button
            onClick={refetchP}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Actualizar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        <TabButton
          active={activeTab === 'espera'}
          onClick={() => setActiveTab('espera')}
          badge={pendientes.length > 0 ? String(pendientes.length) : undefined}
          badgeVariant="amber"
        >
          En espera
        </TabButton>
        <TabButton
          active={activeTab === 'rechazadas'}
          onClick={() => setActiveTab('rechazadas')}
          badge={rechazadasCount > 0 ? String(rechazadasCount) : undefined}
          badgeVariant="red"
        >
          Rechazadas
        </TabButton>
      </div>

      {/* Contenido del tab activo */}
      {activeTab === 'espera' && (
        <TabEspera
          solicitudes={pendientes}
          isLoading={loadingP}
          error={errorP}
          onNavTo={onNavTo}
        />
      )}
      {activeTab === 'rechazadas' && <MisRechazadasTab />}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  children,
  active,
  onClick,
  badge,
  badgeVariant,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
  badgeVariant?: 'amber' | 'red';
}) {
  const badgeCls = badgeVariant === 'red'
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-700';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
        active
          ? 'border-amber-500 text-amber-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
      {badge && (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Tab En espera ─────────────────────────────────────────────────────────────

function TabEspera({
  solicitudes,
  isLoading,
  error,
  onNavTo,
}: {
  solicitudes: SolicitudRenta[];
  isLoading:   boolean;
  error:       string | null;
  onNavTo?:    (section: string) => void;
}) {
  return (
    <>
      {error && <ErrorBanner message={error} />}
      {isLoading ? (
        <SkeletonList />
      ) : solicitudes.length === 0 ? (
        <EmptyEspera onNavTo={onNavTo} />
      ) : (
        <div className="space-y-3">
          {solicitudes.map(s => <SolicitudPendienteCard key={s.id} solicitud={s} />)}
        </div>
      )}
    </>
  );
}

// ── Card pendiente ────────────────────────────────────────────────────────────

function SolicitudPendienteCard({ solicitud }: { solicitud: SolicitudRenta }) {
  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-lg shadow-md overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
            Esperando aprobación
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {tiempoRelativo(solicitud.createdAt)}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-x-6 gap-y-3">

        {/* Cliente */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Cliente</p>
          <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
          <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
        </div>

        {/* Ítems */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Ítems solicitados</p>
          <div className="space-y-1.5">
            {solicitud.items.map((item, i) => <ItemResumen key={i} item={item} />)}
          </div>
        </div>

        {/* Total */}
        <div className="flex flex-col items-end justify-center gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            solicitud.modalidad === 'CONTADO'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
          </span>
          <p className="text-xl font-bold text-slate-800 font-mono">
            Q {solicitud.totalEstimado.toLocaleString('es-GT', {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {solicitud.notas && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
            Observaciones
          </p>
          <p className="text-xs text-slate-600">{solicitud.notas}</p>
        </div>
      )}
    </div>
  );
}

// ── Item resumen ──────────────────────────────────────────────────────────────

function ItemResumen({ item }: { item: ItemSnapshot }) {
  const duracionLabel = unidadLabel(item.duracion, item.unidad);
  const fechaLabel    = formatFechaCorta(item.fechaInicio);

  if (item.kind === 'maquinaria') {
    return (
      <div>
        <p className="text-xs text-slate-700">
          <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
          {item.descripcion}
        </p>
        <TiempoPill duracion={duracionLabel} fecha={fechaLabel} />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-700">
        <span className="font-semibold text-slate-500 mr-1">
          {item.cantidad.toLocaleString('es-GT')}
        </span>
        {item.tipoLabel}
        {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
      </p>
      <TiempoPill duracion={duracionLabel} fecha={fechaLabel} />
    </div>
  );
}

function TiempoPill({ duracion, fecha }: { duracion: string; fecha: string }) {
  return (
    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
      <span className="font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
        {duracion}
      </span>
      <span>desde {fecha}</span>
    </span>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyEspera({ onNavTo }: { onNavTo?: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-slate-600">Sin solicitudes en espera</p>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          No tienes solicitudes pendientes de aprobación en este momento.
        </p>
      </div>
      {onNavTo && (
        <button
          onClick={() => onNavTo('nueva-solicitud')}
          className="mt-1 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva solicitud
        </button>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-5">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {message}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div
          key={i}
          className="h-36 bg-white border border-l-4 border-slate-200 border-l-slate-300 rounded-lg shadow-md animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  return `hace ${Math.floor(horas / 24)}d`;
}
