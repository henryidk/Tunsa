import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import type { LecturaHorometro } from '../../services/solicitudes.service';
import {
  today, localDateOf, generarDias, getDiaStatus,
  DIA_BG, DIA_ICON, DIA_LABEL,
} from '../../utils/horometro.utils';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

interface Props {
  solicitud:    SolicitudRenta;
  lecturas:     LecturaHorometro[] | null; // null = cargando
  onVerDetalle: () => void;
  onRegistrar:  () => void;
}

export default function HorometroRentaCard({ solicitud, lecturas, onVerDetalle, onRegistrar }: Props) {
  const hoy         = today();
  const pesadaItems = (solicitud.items as ItemSnapshot[]).filter(
    (i): i is PesadaItem => i.kind === 'pesada',
  );
  const primerEquipo = pesadaItems[0];

  const fechaInicioStr = solicitud.fechaInicioRenta
    ? solicitud.fechaInicioRenta.substring(0, 10)
    : hoy;

  // Estado de hoy — derivado de ultimaLectura (sin esperar lecturas completas)
  const estadoHoy = (() => {
    const ul = solicitud.ultimaLectura;
    if (!ul || ul.fecha !== hoy) return 'sin-registro' as const;
    if (ul.completa)             return 'completo'     as const;
    return 'parcial' as const;
  })();

  // Últimos 7 días acotados al inicio de la renta
  const hace6Dias = new Date();
  hace6Dias.setDate(hace6Dias.getDate() - 6);
  const desde = localDateOf(hace6Dias);
  const ultimos7 = generarDias(desde < fechaInicioStr ? fechaInicioStr : desde, hoy);

  const borderColor = {
    'completo':     'border-l-emerald-400',
    'parcial':      'border-l-amber-400',
    'sin-registro': 'border-l-red-400',
  }[estadoHoy];

  const estadoBadge = {
    'completo':     { cls: 'bg-emerald-100 text-emerald-700', label: '✓ Al día hoy' },
    'parcial':      { cls: 'bg-amber-100 text-amber-700',     label: '~ Falta cierre' },
    'sin-registro': { cls: 'bg-red-100 text-red-700',         label: '! Sin registros hoy' },
  }[estadoHoy];

  const ctaLabel = estadoHoy === 'sin-registro'
    ? 'Registrar inicio'
    : estadoHoy === 'parcial'
    ? 'Registrar cierre'
    : null;

  const esVencida = !!solicitud.fechaFinEstimada && new Date(solicitud.fechaFinEstimada) < new Date();

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-xl shadow-sm p-5`}>

      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoBadge.cls}`}>
              {estadoBadge.label}
            </span>
            {esVencida && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                Vencida
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-400">{solicitud.folio}</span>
          </div>

          {primerEquipo && (
            <p className="text-sm font-bold text-slate-800 leading-tight">
              <span className="font-mono text-slate-400 mr-1.5">#{primerEquipo.numeracion}</span>
              {primerEquipo.descripcion}
              {pesadaItems.length > 1 && (
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                  +{pesadaItems.length - 1} equipo{pesadaItems.length - 1 > 1 ? 's' : ''}
                </span>
              )}
              <span className="ml-2 text-[11px] font-mono font-normal text-amber-700">
                Q{primerEquipo.tarifaEfectiva.toLocaleString('es-GT', { minimumFractionDigits: 2 })}/hr
              </span>
            </p>
          )}

          <p className="text-xs text-slate-500 mt-0.5">{solicitud.cliente.nombre}</p>
        </div>

        {/* Rango de fechas — esquina superior derecha */}
        {solicitud.fechaInicioRenta && (
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 leading-none mb-0.5">Inicio</p>
              <p className="text-xs font-mono font-medium text-slate-600">
                {fechaInicioStr.split('-').reverse().join('/')}
              </p>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 flex-shrink-0 mt-2">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 leading-none mb-0.5">Fin est.</p>
              <p className={`text-xs font-mono font-semibold ${esVencida ? 'text-red-600' : 'text-slate-600'}`}>
                {solicitud.fechaFinEstimada
                  ? solicitud.fechaFinEstimada.substring(0, 10).split('-').reverse().join('/')
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Últimos días ── */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Últimos {ultimos7.length} {ultimos7.length === 1 ? 'día' : 'días'}
        </p>

        {lecturas === null ? (
          <div className="flex gap-1">
            {ultimos7.map(d => (
              <div key={d} className="w-10 h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-1 flex-wrap">
            {ultimos7.map(d => {
              const status = getDiaStatus(lecturas, d);
              const esHoy  = d === hoy;
              return (
                <div
                  key={d}
                  title={`${d.split('-').reverse().join('/')} · ${DIA_LABEL[status]}`}
                  className={`flex flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border text-[9px] font-bold min-w-[2.5rem]
                    ${DIA_BG[status]}
                    ${esHoy ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                >
                  <span className="text-[11px]">{DIA_ICON[status]}</span>
                  <span className="font-mono mt-0.5">{d.substring(8)}/{d.substring(5, 7)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <button
          onClick={onVerDetalle}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Ver historial →
        </button>

        {ctaLabel ? (
          <button
            onClick={onRegistrar}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {ctaLabel}
          </button>
        ) : (
          <span className="text-xs text-emerald-600 font-semibold">Completo hoy ✓</span>
        )}
      </div>
    </div>
  );
}
