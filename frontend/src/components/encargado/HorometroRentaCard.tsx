import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import ClienteNombre from '../shared/ClienteNombre';
import type { LecturaHorometro } from '../../services/solicitudes.service';
import {
  today, localDateOf, generarDias, getDiaStatus, ultimoDiaHorometro,
  DIA_BG, DIA_ICON, DIA_LABEL,
} from '../../utils/horometro.utils';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

interface Props {
  solicitud:    SolicitudRenta;
  lecturas:     LecturaHorometro[] | null; // null = cargando
  onVerDetalle: () => void;
  onRegistrar:  () => void;
  onVerRenta?:  () => void;
}

export default function HorometroRentaCard({ solicitud, lecturas, onVerDetalle, onRegistrar, onVerRenta }: Props) {
  const hoy         = today();
  const pesadaItems = (solicitud.items as ItemSnapshot[]).filter(
    (i): i is PesadaItem => i.kind === 'pesada',
  );
  const primerEquipo = pesadaItems[0];

  const fechaInicioStr = solicitud.fechaInicioRenta
    ? solicitud.fechaInicioRenta.substring(0, 10)
    : hoy;

  const finEstimadaStr = solicitud.fechaFinEstimada?.substring(0, 10) ?? null;
  const esVencida      = !!finEstimadaStr && finEstimadaStr < hoy;
  const ultimoDia      = ultimoDiaHorometro(finEstimadaStr);

  const diasAtraso = esVencida
    ? Math.floor(
        (new Date(hoy + 'T00:00:00').getTime() - new Date(finEstimadaStr! + 'T00:00:00').getTime())
        / 86_400_000,
      )
    : 0;

  // Para vencidas: el estado de referencia es el último día de trabajo, no hoy
  const refDate = esVencida ? ultimoDia : hoy;

  // Prioriza lecturas frescas del mapa; cae en ultimaLectura solo mientras cargan
  const estadoHoy = (() => {
    if (lecturas !== null) return getDiaStatus(lecturas, refDate);
    const ul = solicitud.ultimaLectura;
    if (!ul || ul.fecha !== refDate) return 'sin-registro' as const;
    if (ul.completa)                 return 'completo'     as const;
    return 'parcial' as const;
  })();

  // Ventana de hasta 7 días anclada al último día de trabajo (no a hoy)
  const hace6DiasDesdeFin = new Date(new Date(ultimoDia + 'T00:00:00').getTime() - 6 * 86_400_000);
  const desdeUltimoDia    = localDateOf(hace6DiasDesdeFin);
  const desdeEfectivo     = desdeUltimoDia < fechaInicioStr ? fechaInicioStr : desdeUltimoDia;
  const ultimos7          = generarDias(desdeEfectivo, ultimoDia);

  const borderColor = {
    'completo':     'border-l-emerald-400',
    'parcial':      'border-l-amber-400',
    'sin-registro': 'border-l-red-400',
  }[estadoHoy];

  const estadoBadge = {
    'completo':     {
      cls:   'bg-emerald-100 text-emerald-700',
      label: esVencida ? '✓ Lecturas al día' : '✓ Al día hoy',
    },
    'parcial':      {
      cls:   'bg-amber-100 text-amber-700',
      label: '~ Falta cierre',
    },
    'sin-registro': {
      cls:   'bg-red-100 text-red-700',
      label: esVencida ? '! Lecturas pendientes' : '! Sin registros hoy',
    },
  }[estadoHoy];

  const ctaLabel = (() => {
    if (esVencida)                    return estadoHoy !== 'completo' ? 'Completar lecturas' : null;
    if (estadoHoy === 'sin-registro') return 'Registrar inicio';
    if (estadoHoy === 'parcial')      return 'Registrar cierre';
    return null;
  })();

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
                Vencida · {diasAtraso}d
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

          <ClienteNombre nombre={solicitud.cliente.nombre} esEspecial={solicitud.cliente.esEspecial} textCls="text-xs text-slate-500" className="flex items-center gap-1.5 flex-wrap mt-0.5" />
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
                {finEstimadaStr
                  ? finEstimadaStr.split('-').reverse().join('/')
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
              const status      = getDiaStatus(lecturas, d);
              const esDestacado = esVencida ? d === ultimoDia : d === hoy;
              return (
                <div
                  key={d}
                  title={`${d.split('-').reverse().join('/')} · ${DIA_LABEL[status]}`}
                  className={`flex flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border text-[9px] font-bold min-w-[2.5rem]
                    ${DIA_BG[status]}
                    ${esDestacado ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
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

        <div className="flex items-center gap-2">
          {onVerRenta && (
            <button
              onClick={onVerRenta}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 17h3v3M17 14h3v3M14 14h3"/>
              </svg>
              Ver renta
            </button>
          )}
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
            <span className="text-xs text-emerald-600 font-semibold">
              {esVencida ? 'Lecturas completas ✓' : 'Completo hoy ✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
