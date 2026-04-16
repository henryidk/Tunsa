import { useEffect, useState, type ReactNode } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import { useActivasStore } from '../../../store/activas.store';
import { useVencidasStore } from '../../../store/vencidas.store';
import type { SolicitudRenta, ItemSnapshot, UnidadDuracion } from '../../../types/solicitud-renta.types';
import { formatFechaHora } from '../../../types/solicitud.types';

// ── Helpers de tiempo ─────────────────────────────────────────────────────────

function calcularFin(inicio: Date, duracion: number, unidad: UnidadDuracion): Date {
  if (unidad === 'dias')    return new Date(inicio.getTime() + duracion * 86_400_000);
  if (unidad === 'semanas') return new Date(inicio.getTime() + duracion * 7  * 86_400_000);
  return new Date(inicio.getTime() + duracion * 30 * 86_400_000);
}

/** ms que quedan hasta el vencimiento (negativo si ya venció) */
function msRestantes(inicio: Date, duracion: number, unidad: UnidadDuracion, ahora: number): number {
  return calcularFin(inicio, duracion, unidad).getTime() - ahora;
}

/** ms mínimos entre todos los ítems de una renta */
function msMinimos(items: ItemSnapshot[], inicio: Date, ahora: number): number {
  if (items.length === 0) return Infinity;
  return Math.min(...items.map(i => msRestantes(inicio, i.duracion, i.unidad, ahora)));
}

type NivelUrgencia = 'vencido' | 'critico' | 'proximo' | 'ok';

function nivelUrgencia(ms: number): NivelUrgencia {
  if (ms <= 0)               return 'vencido';
  if (ms < 24 * 3_600_000)   return 'critico'; // día de vencimiento (< 24 h)
  if (ms <= 72 * 3_600_000)  return 'proximo'; // 1 – 3 días
  return 'ok';
}

/**
 * Formatea el tiempo restante:
 * - ≥ 2 días   → "Xd"
 * - < 24 h     → "Xh Ym" (cuenta regresiva)
 * - < 1 h      → "Ym"
 * - vencido    → "Vencida"
 */
function formatTiempoRestante(ms: number): string {
  if (ms <= 0) return 'Vencida';
  const totalMin = Math.floor(ms / 60_000);
  const horas    = Math.floor(totalMin / 60);
  const mins     = totalMin % 60;
  if (horas >= 24) return `${Math.floor(horas / 24)}d`;
  if (horas === 0) return `${mins}min`;
  return mins === 0 ? `${horas}h` : `${horas}h ${mins}min`;
}

const URGENCIA_BADGE: Record<NivelUrgencia, string> = {
  vencido: 'bg-slate-800 text-white',
  critico: 'bg-red-100 text-red-700 border border-red-200',
  proximo: 'bg-amber-100 text-amber-700 border border-amber-200',
  ok:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const URGENCIA_BORDER: Record<NivelUrgencia, string> = {
  vencido: 'border-l-slate-600',
  critico: 'border-l-red-400',
  proximo: 'border-l-amber-400',
  ok:      'border-l-indigo-400',
};

function VenceLabel({ ms }: { ms: number }) {
  const nivel = nivelUrgencia(ms);
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md ${URGENCIA_BADGE[nivel]}`}>
      {formatTiempoRestante(ms)}
    </span>
  );
}

// ── Sección principal ─────────────────────────────────────────────────────────

export default function RentasActivasSection() {
  const { solicitudes, setSolicitudes } = useActivasStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [abriendo,  setAbriendo]  = useState<string | null>(null);
  // Tick cada minuto — provoca re-render para actualizar cuentas regresivas
  const [ahora,     setAhora]     = useState(() => Date.now());

  useEffect(() => {
    solicitudesService.getActivasMias()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las rentas activas.'))
      .finally(() => setIsLoading(false));
  }, [setSolicitudes]);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Cuando el tick actualiza ahora, detecta rentas que acaban de vencer y las mueve al store de vencidas
  useEffect(() => {
    const recienVencidas = solicitudes.filter(
      s => s.fechaFinEstimada && new Date(s.fechaFinEstimada).getTime() < ahora,
    );
    if (recienVencidas.length === 0) return;
    const { removeRenta }  = useActivasStore.getState();
    const { addVencida }   = useVencidasStore.getState();
    recienVencidas.forEach(s => { removeRenta(s.id); addVencida(s); });
  }, [ahora, solicitudes]);

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

  const contratosActivos    = solicitudes.length;
  const equiposEnCampo      = solicitudes.reduce((sum, s) => sum + s.items.length, 0);
  const ingresosProyectados = solicitudes.reduce((sum, s) => sum + s.totalEstimado, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rentas Activas</h1>
        <p className="text-sm text-slate-500 mt-1">Equipos actualmente rentados por tus clientes</p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Contratos activos"
          value={isLoading ? null : contratosActivos.toString()}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
          color="indigo"
        />
        <StatCard
          label="Equipos en campo"
          value={isLoading ? null : equiposEnCampo.toString()}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          }
          color="amber"
        />
        <StatCard
          label="Ingresos proyectados"
          value={isLoading ? null : `Q ${ingresosProyectados.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
          color="emerald"
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
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : solicitudes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <RentaActivaCard
              key={s.id}
              solicitud={s}
              ahora={ahora}
              abriendo={abriendo === s.id}
              onVerComprobante={() => handleVerComprobante(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function RentaActivaCard({
  solicitud,
  ahora,
  abriendo,
  onVerComprobante,
}: {
  solicitud:        SolicitudRenta;
  ahora:            number;
  abriendo:         boolean;
  onVerComprobante: () => void;
}) {
  const maquinaria  = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel      = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  const inicio = solicitud.fechaInicioRenta ? new Date(solicitud.fechaInicioRenta) : new Date();
  const msMin  = msMinimos(solicitud.items, inicio, ahora);
  const nivel  = nivelUrgencia(msMin);

  return (
    <div className={`bg-white border border-slate-200 border-l-4 rounded-xl shadow-sm overflow-hidden ${URGENCIA_BORDER[nivel]}`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Activa
          </span>
          {nivel !== 'ok' && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${URGENCIA_BADGE[nivel]}`}>
              {nivel === 'vencido' ? 'Vencida' : `Vence en ${formatTiempoRestante(msMin)}`}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <span className="text-xs text-slate-400">
          Inicio {solicitud.fechaInicioRenta ? formatFechaHora(solicitud.fechaInicioRenta) : '—'}
        </span>
      </div>

      {/* Body — 2 columnas: info + equipos */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

        {/* Columna izquierda: cliente + total */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
            {solicitud.cliente.telefono && (
              <p className="text-xs text-slate-500 mt-0.5">{solicitud.cliente.telefono}</p>
            )}
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Total</p>
              <p className="text-lg font-bold text-slate-800 font-mono leading-none">
                Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              solicitud.modalidad === 'CONTADO'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
            </span>
          </div>
        </div>

        {/* Columna derecha: equipos con vencimiento */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos rentados</p>
          <div className="space-y-2.5">
            {maquinaria.map((item, i) => {
              const fin = calcularFin(inicio, item.duracion, item.unidad);
              const ms  = msRestantes(inicio, item.duracion, item.unidad, ahora);
              return (
                <div key={i} className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 leading-tight">
                    <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                    {item.descripcion}
                  </p>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      Vence {formatFechaHora(fin.toISOString())}
                    </span>
                    <VenceLabel ms={ms} />
                  </div>
                </div>
              );
            })}
            {granel.map((item, i) => {
              const fin = calcularFin(inicio, item.duracion, item.unidad);
              const ms  = msRestantes(inicio, item.duracion, item.unidad, ahora);
              return (
                <div key={i} className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 leading-tight">
                    <span className="font-mono text-indigo-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
                    {item.tipoLabel}
                    {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
                  </p>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      Vence {formatFechaHora(fin.toISOString())}
                    </span>
                    <VenceLabel ms={ms} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footer de acciones */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">

        {/* Acciones secundarias (izquierda) */}
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

        {/* Acciones primarias (derecha) */}
        <div className="flex items-center gap-2">
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-xs font-semibold text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Próximamente"
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
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Próximamente"
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
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

type StatColor = 'indigo' | 'amber' | 'emerald';

const STAT_COLORS: Record<StatColor, { bg: string; icon: string; value: string }> = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  value: 'text-indigo-700' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   value: 'text-amber-700'  },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', value: 'text-emerald-700' },
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p className="text-sm font-medium">Sin rentas activas</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        Aquí aparecerán las rentas que hayas confirmado entregar.
      </p>
    </div>
  );
}
