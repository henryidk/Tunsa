import { useEffect, useState, type ReactNode } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import { useVencidasStore } from '../../../store/vencidas.store';
import { useActivasStore } from '../../../store/activas.store';
import type { SolicitudRenta, ItemSnapshot, UnidadDuracion, ExtensionEntry } from '../../../types/solicitud-renta.types';
import { formatFechaHora } from '../../../types/solicitud.types';
import AmpliacionRentaModal from '../AmpliacionRentaModal';
import TiempoGraciaModal    from '../TiempoGraciaModal';
import DevolucionModal      from '../DevolucionModal';

// ── Constantes de negocio ─────────────────────────────────────────────────────

const GRACE_MS   = 3_600_000; // 1 hora de gracia
const DAY_MS     = 86_400_000;

// ── Helpers de tiempo y recargo ───────────────────────────────────────────────

function calcularFin(inicio: Date, duracion: number, unidad: UnidadDuracion): Date {
  if (unidad === 'horas')   return new Date(inicio.getTime() + duracion * 3_600_000);
  if (unidad === 'dias')    return new Date(inicio.getTime() + duracion * DAY_MS);
  if (unidad === 'semanas') return new Date(inicio.getTime() + duracion * 7 * DAY_MS);
  return new Date(inicio.getTime() + duracion * 30 * DAY_MS);
}

/** Fecha de vencimiento efectiva de un ítem, apilando todas sus extensiones. */
function calcularFinConExtensiones(
  inicio:      Date,
  item:        ItemSnapshot,
  extensiones: ExtensionEntry[],
): Date {
  const ref  = item.kind === 'maquinaria' ? item.equipoId : item.tipo;
  const exts = extensiones.filter(e => e.itemRef === ref);
  let fin = calcularFin(inicio, item.duracion, item.unidad);
  for (const ext of exts) {
    fin = calcularFin(fin, ext.duracion, ext.unidad);
  }
  return fin;
}

function calcularFinEstimado(items: ItemSnapshot[], inicio: Date, extensiones: ExtensionEntry[]): Date {
  const fins = items.map(i => calcularFinConExtensiones(inicio, i, extensiones).getTime());
  return new Date(Math.min(...fins));
}

/** Recargo de un ítem individual dado el momento actual. */
function calcularRecargoItem(tarifa: number, finItem: Date, ahora: number): number {
  const excesoMs = ahora - finItem.getTime() - GRACE_MS;
  if (excesoMs <= 0) return 0;
  return Math.ceil(excesoMs / DAY_MS) * tarifa;
}

/** Recargo total proyectado al momento actual, sumando todos los ítems con tarifa (con extensiones). */
function calcularRecargoActual(items: ItemSnapshot[], inicio: Date, ahora: number, extensiones: ExtensionEntry[]): number {
  return items.reduce((suma, item) => {
    const tarifa = (item as { tarifa?: number | null }).tarifa ?? null;
    if (tarifa === null) return suma;
    const fin = calcularFinConExtensiones(inicio, item, extensiones);
    return suma + calcularRecargoItem(tarifa, fin, ahora);
  }, 0);
}

/** Milisegundos de atraso (negativo = dentro de gracia, no hay cargo aún). */
function msAtraso(fechaVencimiento: Date, ahora: number): number {
  return ahora - fechaVencimiento.getTime();
}

/**
 * Momento exacto en que cambiará el recargo para una renta dada.
 * - Si sigue en gracia → cambia cuando termina la gracia.
 * - Si ya pasó la gracia → cambia al próximo múltiplo de 24h desde el fin de la gracia.
 */
function proximoCambioRecargo(vencimiento: Date, ahora: number): number {
  const graceEnd  = vencimiento.getTime() + GRACE_MS;
  if (ahora < graceEnd) return graceEnd;
  const excesoMs  = ahora - graceEnd;
  return graceEnd + Math.ceil(excesoMs / DAY_MS) * DAY_MS;
}

/**
 * Momento más próximo en que alguna renta de la lista cambiará su recargo.
 * Devuelve Infinity si no hay rentas.
 */
function proximoCambioGlobal(solicitudes: SolicitudRenta[], ahora: number): number {
  return solicitudes.reduce((min, s) => {
    const inicio      = s.fechaInicioRenta ? new Date(s.fechaInicioRenta) : new Date();
    const extensiones = s.extensiones ?? [];
    const vencimiento = s.fechaFinEstimada
      ? new Date(s.fechaFinEstimada)
      : calcularFinEstimado(s.items, inicio, extensiones);
    return Math.min(min, proximoCambioRecargo(vencimiento, ahora));
  }, Infinity);
}

function formatAtraso(ms: number): string {
  if (ms <= GRACE_MS) return 'En gracia';
  const totalMin = Math.floor((ms - GRACE_MS) / 60_000);
  const horas    = Math.floor(totalMin / 60);
  if (horas < 24) return `${horas}h ${totalMin % 60}min`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}


// ── Sección principal ─────────────────────────────────────────────────────────

export default function VencidasSection() {
  const { solicitudes, setSolicitudes, removeRenta, updateRenta } = useVencidasStore();
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  // ahora       → tick de 60s, mantiene el display de atraso actualizado minuto a minuto
  // ahoraRecargo → tick inteligente, solo despierta cuando cambia el monto del recargo
  const [ahora,           setAhora]           = useState(() => Date.now());
  const [ahoraRecargo,    setAhoraRecargo]    = useState(() => Date.now());
  const [abriendo,        setAbriendo]        = useState<string | null>(null);
  const [modalAmpliar,    setModalAmpliar]    = useState<SolicitudRenta | null>(null);
  const [modalGracia,     setModalGracia]     = useState<SolicitudRenta | null>(null);
  const [modalDevolucion, setModalDevolucion] = useState<SolicitudRenta | null>(null);

  useEffect(() => {
    solicitudesService.getVencidasMias()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las rentas vencidas.'))
      .finally(() => setIsLoading(false));
  }, [setSolicitudes]);

  // Tick de 60s — actualiza el display de atraso ("Vencida hace Xh Ymin") minuto a minuto
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Tick inteligente — duerme hasta el próximo cambio de recargo (cada 24h tras la gracia)
  useEffect(() => {
    if (solicitudes.length === 0) return;
    const next  = proximoCambioGlobal(solicitudes, ahoraRecargo);
    const delay = next - Date.now();
    if (delay <= 0) { setAhoraRecargo(Date.now()); return; }
    const id = setTimeout(() => setAhoraRecargo(Date.now()), delay);
    return () => clearTimeout(id);
  }, [solicitudes, ahoraRecargo]);

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

  const transicionarTrasExtension = (actualizada: SolicitudRenta) => {
    const ahora    = Date.now();
    const nuevaFin = actualizada.fechaFinEstimada ? new Date(actualizada.fechaFinEstimada).getTime() : 0;
    if (nuevaFin > ahora) {
      removeRenta(actualizada.id);
      useActivasStore.getState().addRenta(actualizada);
    } else {
      updateRenta(actualizada);
    }
  };

  const handleAmpliarVencida = (actualizada: SolicitudRenta) => {
    setModalAmpliar(null);
    transicionarTrasExtension(actualizada);
  };

  const handleGracia = (actualizada: SolicitudRenta) => {
    setModalGracia(null);
    transicionarTrasExtension(actualizada);
  };

  /**
   * Post-devolución: si la renta quedó DEVUELTA la sacamos de vencidas.
   * Si fue parcial, usamos la misma lógica de transición que las extensiones:
   * nueva fechaFinEstimada > ahora → pasa a activas; si no → se queda en vencidas.
   */
  const handleDevolucionVencida = (actualizada: SolicitudRenta) => {
    if (actualizada.estado === 'DEVUELTA') {
      removeRenta(actualizada.id);
    } else {
      transicionarTrasExtension(actualizada);
    }
  };

  const totalRecargo = solicitudes.reduce((suma, s) => {
    const inicio      = s.fechaInicioRenta ? new Date(s.fechaInicioRenta) : new Date();
    const extensiones = s.extensiones ?? [];
    return suma + calcularRecargoActual(s.items, inicio, ahoraRecargo, extensiones);
  }, 0);

  const equiposPendientes = solicitudes.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div>
      {modalAmpliar && (
        <AmpliacionRentaModal
          solicitud={modalAmpliar}
          onClose={() => setModalAmpliar(null)}
          onAmpliar={handleAmpliarVencida}
        />
      )}
      {modalGracia && (
        <TiempoGraciaModal
          solicitud={modalGracia}
          onClose={() => setModalGracia(null)}
          onGracia={handleGracia}
        />
      )}
      {modalDevolucion && (
        <DevolucionModal
          solicitud={modalDevolucion}
          onClose={() => setModalDevolucion(null)}
          onDevolucion={handleDevolucionVencida}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rentas Vencidas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Equipos cuya fecha de devolución ya pasó — el cliente tiene 1 h de gracia antes de que corran cargos adicionales
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Contratos vencidos"
          value={isLoading ? null : solicitudes.length.toString()}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
          color="red"
        />
        <StatCard
          label="Equipos pendientes"
          value={isLoading ? null : equiposPendientes.toString()}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          }
          color="amber"
        />
        <StatCard
          label="Recargo acumulado"
          value={isLoading ? null : `Q ${totalRecargo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
          color="orange"
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : solicitudes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <RentaVencidaCard
              key={s.id}
              solicitud={s}
              ahora={ahora}
              ahoraRecargo={ahoraRecargo}
              abriendo={abriendo === s.id}
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

// ── Card ──────────────────────────────────────────────────────────────────────

function RentaVencidaCard({
  solicitud,
  ahora,
  ahoraRecargo,
  abriendo,
  onVerComprobante,
  onAmpliar,
  onGracia,
  onDevolucion,
}: {
  solicitud:        SolicitudRenta;
  ahora:            number; // tick 60s — para display de atraso
  ahoraRecargo:     number; // tick inteligente — para cálculo de montos
  abriendo:         boolean;
  onVerComprobante: () => void;
  onAmpliar:        () => void;
  onGracia:         () => void;
  onDevolucion:     () => void;
}) {
  const extensiones = solicitud.extensiones ?? [];
  const inicio      = solicitud.fechaInicioRenta ? new Date(solicitud.fechaInicioRenta) : new Date();
  const vencimiento = solicitud.fechaFinEstimada
    ? new Date(solicitud.fechaFinEstimada)
    : calcularFinEstimado(solicitud.items, inicio, extensiones);

  const atrasoMs = msAtraso(vencimiento, ahora);         // usa tick 60s
  const enGracia = atrasoMs <= GRACE_MS;
  const recargo  = calcularRecargoActual(solicitud.items, inicio, ahoraRecargo, extensiones); // usa tick inteligente
  const total      = solicitud.totalEstimado + recargo;

  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden border-l-4 ${
      enGracia ? 'border-l-amber-400' : 'border-l-red-500'
    }`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5 flex-wrap">
          {enGracia ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              En gracia
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Vencida
            </span>
          )}
          {!enGracia && (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Atraso: {formatAtraso(atrasoMs)}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">Debía terminar</p>
          <p className="text-xs font-semibold text-slate-600">{formatFechaHora(vencimiento.toISOString())}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

        {/* Columna izquierda: cliente + montos */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
            {solicitud.cliente.telefono && (
              <p className="text-xs text-slate-500 mt-0.5">{solicitud.cliente.telefono}</p>
            )}
          </div>

          {/* Desglose de montos */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Monto inicial</span>
              <span className="font-mono">
                Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={recargo > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                Recargo por atraso
              </span>
              <span className={`font-mono ${recargo > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {recargo > 0
                  ? `+ Q ${recargo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                  : '— (dentro de gracia)'}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between">
              <span className="text-sm font-bold text-slate-800">Total</span>
              <span className="text-sm font-bold font-mono text-slate-900">
                Q {total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400">Inicio de renta</p>
            <p className="text-xs font-semibold text-slate-600">
              {solicitud.fechaInicioRenta ? formatFechaHora(solicitud.fechaInicioRenta) : '—'}
            </p>
          </div>
        </div>

        {/* Columna derecha: equipos */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos a devolver</p>
          <div className="space-y-2">
            {maquinaria.map((item, i) => {
              const fin     = calcularFinConExtensiones(inicio, item, extensiones);
              const itemRec = calcularRecargoItem((item as { tarifa?: number | null }).tarifa ?? 0, fin, ahoraRecargo);
              return (
                <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <p className="text-xs font-medium text-slate-700 leading-tight">
                    <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                    {item.descripcion}
                  </p>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      Venció {formatFechaHora(fin.toISOString())}
                    </span>
                    {itemRec > 0 && (
                      <span className="text-[10px] font-semibold text-red-600 font-mono">
                        +Q {itemRec.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {granel.map((item, i) => {
              const fin     = calcularFinConExtensiones(inicio, item, extensiones);
              const tarifa  = (item as { tarifa?: number | null }).tarifa ?? 0;
              const itemRec = calcularRecargoItem(tarifa, fin, ahoraRecargo);
              return (
                <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <p className="text-xs font-medium text-slate-700 leading-tight">
                    <span className="font-mono text-indigo-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
                    {item.tipoLabel}
                    {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
                  </p>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      Venció {formatFechaHora(fin.toISOString())}
                    </span>
                    {itemRec > 0 && (
                      <span className="text-[10px] font-semibold text-red-600 font-mono">
                        +Q {itemRec.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footer de acciones */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {solicitud.comprobanteKey && (
              <button
                onClick={onVerComprobante}
                disabled={abriendo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors disabled:opacity-60"
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
                Ver comprobante
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onGracia}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-xs font-semibold text-amber-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Tiempo de gracia
            </button>
            <button
              onClick={onAmpliar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-xs font-semibold text-indigo-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="14" x2="12" y2="18"/>
                <line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
              Ampliar renta
            </button>
            <button
              onClick={onDevolucion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 14 4 9 9 4"/>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
              Registrar devolución
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

type StatColor = 'red' | 'amber' | 'orange';

const STAT_COLORS: Record<StatColor, { bg: string; icon: string; value: string }> = {
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    value: 'text-red-700'    },
  amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  value: 'text-amber-700'  },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', value: 'text-orange-700' },
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | null;
  icon:  ReactNode;
  color: StatColor;
}) {
  const c = STAT_COLORS[color];
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        {value === null ? (
          <div className="mt-1 h-6 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className={`text-xl font-bold font-mono ${c.value}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <p className="text-sm font-medium">Sin rentas vencidas</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        Todas tus rentas activas están dentro de plazo.
      </p>
    </div>
  );
}
