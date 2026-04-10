import { useState, useEffect, useCallback } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../../types/solicitud.types';

export default function HistorialSection() {
  const [solicitudes,  setSolicitudes]  = useState<SolicitudRenta[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (silencioso) setIsRefreshing(true);
    try {
      const data = await solicitudesService.getMiasHistorial();
      setSolicitudes(data);
      setError(null);
    } catch {
      setError('No se pudo cargar el historial.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial</h1>
          <p className="text-sm text-slate-500 mt-1">
            Solicitudes que fueron rechazadas por secretaría
          </p>
        </div>
        <button
          onClick={() => cargar(true)}
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
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Contenido */}
      {isLoading ? (
        <SkeletonList />
      ) : solicitudes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {solicitudes.map(s => <SolicitudRechazadaCard key={s.id} solicitud={s} />)}
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SolicitudRechazadaCard({ solicitud }: { solicitud: SolicitudRenta }) {
  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-red-400 rounded-lg shadow-md overflow-hidden opacity-90">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-red-50 border-b border-red-100">
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 flex-shrink-0">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
            Rechazada
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
          <p className="text-xl font-bold text-slate-500 font-mono line-through decoration-red-300">
            Q {solicitud.totalEstimado.toLocaleString('es-GT', {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Footer — observaciones */}
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
      <span className="font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
        {duracion}
      </span>
      <span>desde {fecha}</span>
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-slate-600">Sin solicitudes rechazadas</p>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Las solicitudes que sean rechazadas por secretaría aparecerán aquí.
        </p>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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
