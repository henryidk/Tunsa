import { useState, useCallback, useEffect, useRef } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';
import RentaHistorialCard from '../../shared/RentaHistorialCard';

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hoy(): string {
  return toDateInput(new Date());
}

function inicioMes(): string {
  const d = new Date();
  d.setDate(1);
  return toDateInput(d);
}

function startOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

// ── Sección principal ─────────────────────────────────────────────────────────

export default function HistorialSection() {
  const [fechaDesde,    setFechaDesde]    = useState(inicioMes());
  const [fechaHasta,    setFechaHasta]    = useState(hoy());
  const [filtroActivo,  setFiltroActivo]  = useState({ desde: inicioMes(), hasta: hoy() });
  const [solicitudes,   setSolicitudes]   = useState<SolicitudRenta[]>([]);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (desde: string, hasta: string) => {
    setIsLoading(true);
    setError(null);
    setSolicitudes([]);
    setNextCursor(null);
    setFiltroActivo({ desde, hasta });
    try {
      const res = await solicitudesService.getHistorial({
        fechaDesde: startOfDay(desde),
        fechaHasta: endOfDay(hasta),
      });
      setSolicitudes(res.data);
      setNextCursor(res.nextCursor);
    } catch {
      setError('No se pudo cargar el historial. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cargarMas = useCallback(async (cursor: string, desde: string, hasta: string) => {
    setIsLoadingMore(true);
    try {
      const res = await solicitudesService.getHistorial({
        fechaDesde: startOfDay(desde),
        fechaHasta: endOfDay(hasta),
        cursor,
      });
      setSolicitudes(prev => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch {
      setError('No se pudo cargar más registros.');
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    buscar(inicioMes(), hoy());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || !nextCursor || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) cargarMas(nextCursor, filtroActivo.desde, filtroActivo.hasta);
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextCursor, isLoadingMore, filtroActivo, cargarMas]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Historial de Rentas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro de devoluciones parciales y rentas finalizadas de todos los encargados
        </p>
      </div>

      <FiltroFechas
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        isLoading={isLoading}
        onChangeDe={setFechaDesde}
        onChangeHasta={setFechaHasta}
        onBuscar={() => buscar(fechaDesde, fechaHasta)}
      />

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <Skeletons />
      ) : solicitudes.length === 0 ? (
        <SinResultados />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <RentaHistorialCard key={s.id} solicitud={s} showEncargado />
          ))}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isLoadingMore && <Spinner />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes de UI ─────────────────────────────────────────────────────

function FiltroFechas({
  fechaDesde, fechaHasta, isLoading, onChangeDe, onChangeHasta, onBuscar,
}: {
  fechaDesde:    string;
  fechaHasta:    string;
  isLoading:     boolean;
  onChangeDe:    (v: string) => void;
  onChangeHasta: (v: string) => void;
  onBuscar:      () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-end gap-4 shadow-sm">
      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Desde</label>
        <input
          type="date"
          value={fechaDesde}
          max={fechaHasta}
          onChange={e => onChangeDe(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Hasta</label>
        <input
          type="date"
          value={fechaHasta}
          min={fechaDesde}
          onChange={e => onChangeHasta(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <button
        onClick={onBuscar}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {isLoading ? <Spinner size={14} /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        )}
        Buscar
      </button>
    </div>
  );
}

function Skeletons() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin text-slate-400" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function SinResultados() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <p className="text-sm font-medium">Sin registros en este período</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        No hay devoluciones en las fechas seleccionadas.
      </p>
    </div>
  );
}
