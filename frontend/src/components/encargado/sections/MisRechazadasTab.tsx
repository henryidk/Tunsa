import { useState, useEffect, useCallback, useMemo } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import { useRechazadasStore } from '../../../store/rechazadas.store';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, formatFechaHora, unidadLabel } from '../../../types/solicitud.types';

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function startOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MisRechazadasTab() {
  const hoy = toDateInput(new Date());

  const [fechaDesde,    setFechaDesde]    = useState(hoy);
  const [fechaHasta,    setFechaHasta]    = useState(hoy);
  const [apiData,       setApiData]       = useState<SolicitudRenta[]>([]);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Selector estable: referencia directa al array; filtro derivado en useMemo.
  // Zustand v5 lanza "unstable snapshot" si el selector devuelve una nueva
  // referencia en cada llamada, aunque los datos no cambien.
  const allRechazadas   = useRechazadasStore(s => s.solicitudes);
  const storeRechazadas = useMemo(() => allRechazadas, [allRechazadas]);

  const cargarPrimera = useCallback(async (desde: string, hasta: string) => {
    setIsLoading(true);
    setError(null);
    setApiData([]);
    setNextCursor(null);
    try {
      const res = await solicitudesService.getRechazadasMias({
        fechaDesde: startOfDay(desde),
        fechaHasta: endOfDay(hasta),
      });
      setApiData(res.data);
      setNextCursor(res.nextCursor);
    } catch {
      setError('No se pudieron cargar las solicitudes rechazadas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cargarMas = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await solicitudesService.getRechazadasMias({
        fechaDesde: startOfDay(fechaDesde),
        fechaHasta: endOfDay(fechaHasta),
        cursor:     nextCursor,
      });
      setApiData(prev => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch {
      setError('Error al cargar más solicitudes.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    cargarPrimera(fechaDesde, fechaHasta);
  }, [fechaDesde, fechaHasta, cargarPrimera]);

  // Combinar store (tiempo real, sesión actual) + API (historial paginado).
  // Las del store van primero — son las más recientes. Se deduplica por id.
  const storeIds = new Set(storeRechazadas.map(s => s.id));
  const combined = [
    ...storeRechazadas,
    ...apiData.filter(s => !storeIds.has(s.id)),
  ];

  return (
    <div>
      {/* Filtro de fecha */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            max={fechaHasta}
            onChange={e => setFechaDesde(e.target.value)}
            className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            min={fechaDesde}
            max={toDateInput(new Date())}
            onChange={e => setFechaHasta(e.target.value)}
            className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        {(fechaDesde !== hoy || fechaHasta !== hoy) && (
          <button
            onClick={() => { setFechaDesde(hoy); setFechaHasta(hoy); }}
            className="ml-auto text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <SkeletonList />
      ) : combined.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {combined.map(s => <SolicitudRechazadaCard key={s.id} solicitud={s} />)}
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-5">
              <button
                onClick={cargarMas}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isLoadingMore ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                )}
                {isLoadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SolicitudRechazadaCard({ solicitud }: { solicitud: SolicitudRenta }) {
  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-red-400 rounded-lg shadow-md overflow-hidden">

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
        <span className="text-xs text-slate-400">
          {solicitud.fechaDecision ? formatFechaHora(solicitud.fechaDecision) : '—'}
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
          <p className="text-xl font-bold text-slate-400 font-mono line-through decoration-red-300">
            Q {solicitud.totalEstimado.toLocaleString('es-GT', {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {solicitud.motivoRechazo && (
        <div className="mx-5 mb-4 flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-0.5">
              Motivo de rechazo
            </p>
            <p className="text-xs text-red-700 leading-relaxed">{solicitud.motivoRechazo}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item resumen ──────────────────────────────────────────────────────────────

function ItemResumen({ item }: { item: ItemSnapshot }) {
  const duracionLabel = unidadLabel(item.duracion, item.unidad);
  const fechaLabel    = formatFechaCorta(item.fechaInicio);

  if (item.kind === 'maquinaria' || item.kind === 'pesada') {
    return (
      <div>
        <p className="text-xs text-slate-700">
          <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
          {item.descripcion}
          {item.kind === 'pesada' && item.conMartillo && (
            <span className="ml-1.5 text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">+Martillo</span>
          )}
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
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <p className="text-sm font-medium">Sin rechazadas en este período</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        No tienes solicitudes rechazadas en el rango de fechas seleccionado.
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
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
