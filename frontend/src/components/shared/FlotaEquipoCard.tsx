import type { FlotaItem } from '../../types/flota.types';

const ESTADO_CFG = {
  'disponible': {
    border: 'border-l-emerald-400',
    badge:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot:    'bg-emerald-500',
    label:  'Disponible',
    pulse:  false,
  },
  'en-renta': {
    border: 'border-l-indigo-400',
    badge:  'bg-indigo-100 text-indigo-700 border-indigo-200',
    dot:    'bg-indigo-500',
    label:  'En renta',
    pulse:  false,
  },
  'vencida': {
    border: 'border-l-red-500',
    badge:  'bg-red-100 text-red-700 border-red-200',
    dot:    'bg-red-500',
    label:  'Vencida',
    pulse:  true,
  },
} as const;

function diasAtraso(fechaFinEstimada: string): number {
  const fin = new Date(fechaFinEstimada + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoy.getTime() - fin.getTime()) / 86_400_000));
}

function fmtFecha(iso: string): string {
  return iso.split('-').reverse().join('/');
}

interface Props {
  item:        FlotaItem;
  onVerRenta?: (folio: string, estado: 'en-renta' | 'vencida') => void;
}

export default function FlotaEquipoCard({ item, onVerRenta }: Props) {
  const cfg   = ESTADO_CFG[item.estado];
  const atraso = item.estado === 'vencida' && item.renta?.fechaFinEstimada
    ? diasAtraso(item.renta.fechaFinEstimada)
    : 0;

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${cfg.border} rounded-xl shadow-sm px-5 py-3.5`}>
      <div className="flex items-start justify-between gap-4">

        {/* Left: estado + nombre + detalle */}
        <div className="min-w-0 flex-1">

          {/* Fila 1: badge de estado + tipo + folio */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
              {cfg.label}{item.estado === 'vencida' && atraso > 0 ? ` · ${atraso}d` : ''}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              item.esPesada
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {item.esPesada ? 'Pesada' : 'Liviana'}
            </span>
            {item.renta?.folio && (
              <span className="text-[11px] font-mono text-slate-400">{item.renta.folio}</span>
            )}
          </div>

          {/* Fila 2: numeración + descripción */}
          <p className="text-sm font-bold text-slate-800 leading-snug">
            <span className="font-mono text-slate-400 mr-1.5">#{item.numeracion}</span>
            {item.descripcion}
          </p>

          {/* Fila 3: info contextual */}
          {item.estado === 'disponible' ? (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {item.categoria ?? 'Sin categoría'}
            </p>
          ) : item.renta ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs font-semibold text-slate-700">{item.renta.clienteNombre}</p>
              {item.renta.fechaFinEstimada && (
                <p className={`text-[11px] ${item.estado === 'vencida' ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                  {item.estado === 'vencida' ? 'Venció' : 'Vence'}: {fmtFecha(item.renta.fechaFinEstimada)}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Right: botón de navegación */}
        {(item.estado === 'en-renta' || item.estado === 'vencida') && item.renta?.folio && onVerRenta && (
          <button
            onClick={() => onVerRenta(item.renta!.folio!, item.estado as 'en-renta' | 'vencida')}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors self-center"
          >
            Ver renta
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
