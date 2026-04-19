import { useState, useCallback, useEffect, useRef } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta, DevolucionEntry } from '../../../types/solicitud-renta.types';
import { formatFechaHora, formatQ } from '../../../types/solicitud.types';
import { resolverLabelItem } from '../../../utils/devolucion.helpers';

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

// ── Conteo de ítems pendientes ────────────────────────────────────────────────

function contarItemsPendientes(solicitud: SolicitudRenta): number {
  const yaDevueltos = new Set<string>(
    (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
  );
  return solicitud.items.filter(item => {
    const ref = item.kind === 'maquinaria' ? item.equipoId : item.tipo;
    return !yaDevueltos.has(ref);
  }).length;
}

// ── Sección principal ─────────────────────────────────────────────────────────

export default function HistorialSection() {
  // Inputs del filtro — lo que el usuario está editando
  const [fechaDesde,  setFechaDesde]  = useState(inicioMes());
  const [fechaHasta,  setFechaHasta]  = useState(hoy());

  // Filtro activo — el que se usó en la última búsqueda exitosa.
  // Separado de los inputs para que cargarMas siempre use las fechas correctas,
  // incluso si el usuario modificó los inputs sin volver a buscar.
  const [filtroActivo, setFiltroActivo] = useState({ desde: inicioMes(), hasta: hoy() });

  const [solicitudes,   setSolicitudes]   = useState<SolicitudRenta[]>([]);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Ref del elemento centinela al final de la lista — disparará cargarMas
  // cuando entre en el viewport (IntersectionObserver).
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (desde: string, hasta: string) => {
    setIsLoading(true);
    setError(null);
    setSolicitudes([]);
    setNextCursor(null);
    setFiltroActivo({ desde, hasta });
    try {
      const res = await solicitudesService.getMiasHistorial({
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
      const res = await solicitudesService.getMiasHistorial({
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

  // Carga inicial al montar el componente con el rango del mes actual
  useEffect(() => {
    buscar(inicioMes(), hoy());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll infinito: cuando el centinela entra en el viewport y hay más páginas,
  // carga la siguiente. Se desconecta mientras isLoadingMore para evitar dobles llamadas.
  useEffect(() => {
    if (!sentinelRef.current || !nextCursor || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          cargarMas(nextCursor, filtroActivo.desde, filtroActivo.hasta);
        }
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
          Registro de devoluciones parciales y rentas finalizadas
        </p>
      </div>

      {/* Filtro de fechas */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-end gap-4 shadow-sm">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            Desde
          </label>
          <input
            type="date"
            value={fechaDesde}
            max={fechaHasta}
            onChange={e => setFechaDesde(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={fechaHasta}
            min={fechaDesde}
            onChange={e => setFechaHasta(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          onClick={() => buscar(fechaDesde, fechaHasta)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {isLoading ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          )}
          Buscar
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : solicitudes.length === 0 ? (
        <SinResultados />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <RentaHistorialCard key={s.id} solicitud={s} />
          ))}

          {/* Centinela de scroll infinito */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isLoadingMore && (
              <svg className="animate-spin text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card de renta ─────────────────────────────────────────────────────────────

function RentaHistorialCard({ solicitud }: { solicitud: SolicitudRenta }) {
  const devuelto    = solicitud.estado === 'DEVUELTA';
  const pendientes  = devuelto ? 0 : contarItemsPendientes(solicitud);
  const devoluciones = solicitud.devolucionesParciales ?? [];

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden border-l-4 ${
      devuelto ? 'border-l-emerald-500 border-slate-200' : 'border-l-amber-400 border-slate-200'
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5 flex-wrap">
          {devuelto ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Devuelta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Renta abierta · {pendientes} {pendientes === 1 ? 'equipo pendiente' : 'equipos pendientes'}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-700">{solicitud.cliente.nombre}</p>
          {devuelto && solicitud.totalFinal != null && (
            <p className="text-[11px] text-slate-500 font-mono">
              Total final: <span className="font-bold text-slate-800">{formatQ(solicitud.totalFinal)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Lotes */}
      <div className="divide-y divide-slate-100">
        {devoluciones.map((lote, idx) => (
          <LoteRow
            key={idx}
            solicitud={solicitud}
            lote={lote}
            loteIndex={idx}
            loteTotal={devoluciones.length}
          />
        ))}
      </div>

    </div>
  );
}

// ── Fila de lote ──────────────────────────────────────────────────────────────

function LoteRow({
  solicitud,
  lote,
  loteIndex,
  loteTotal,
}: {
  solicitud:  SolicitudRenta;
  lote:       DevolucionEntry;
  loteIndex:  number;
  loteTotal:  number;
}) {
  const [abriendo, setAbriendo] = useState(false);

  const handleVerLiquidacion = async () => {
    setAbriendo(true);
    try {
      const { url } = await solicitudesService.getLiquidacionUrl(solicitud.id, loteIndex);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso — el botón solo aparece si liquidacionKey existe
    } finally {
      setAbriendo(false);
    }
  };

  const esTardia  = lote.tipoDevolucion === 'TARDIA';
  const numLote   = loteIndex + 1;

  return (
    <div className="px-5 py-4">

      {/* Cabecera del lote */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Lote {numLote} {loteTotal > 1 ? `de ${loteTotal}` : ''}
          </span>
          {lote.esParcial && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
              Parcial
            </span>
          )}
          {esTardia && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
              Tardía
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">
          {formatFechaHora(lote.fechaDevolucion)}
        </span>
      </div>

      {/* Ítems del lote */}
      <div className="space-y-1.5 mb-3">
        {lote.items.map((entry, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-slate-700 leading-snug">
              {resolverLabelItem(solicitud, entry)}
            </span>
            <div className="shrink-0 text-right">
              <span className="text-slate-500">
                {entry.diasCobrados} día{entry.diasCobrados !== 1 ? 's' : ''} · {formatQ(entry.costoReal)}
              </span>
              {entry.recargoTiempo > 0 && (
                <span className="block text-red-500 font-medium">
                  + recargo {formatQ(entry.recargoTiempo)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cargos adicionales */}
      {lote.recargosAdicionales.length > 0 && (
        <div className="space-y-1 mb-3 pl-3 border-l-2 border-amber-200">
          {lote.recargosAdicionales.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-amber-700">{c.descripcion}</span>
              <span className="text-amber-700 font-medium">{formatQ(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer del lote: total + liquidación */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-700">
          Total lote: <span className="font-mono">{formatQ(lote.totalLote)}</span>
        </span>
        {lote.liquidacionKey && (
          <button
            onClick={handleVerLiquidacion}
            disabled={abriendo}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-60"
          >
            {abriendo ? (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            )}
            Ver liquidación
          </button>
        )}
      </div>
    </div>
  );
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

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
