import { useAuthStore } from '../../store/auth.store';
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
  const user     = useAuthStore(s => s.user);
  const roleName = user?.role.nombre;
  const tieneAccesoGlobal = roleName === 'admin' || roleName === 'secretaria';
  const puedeVerRenta     = tieneAccesoGlobal || item.renta?.creadaPor === user?.username;
  const cfg      = ESTADO_CFG[item.estado];
  const atraso   = item.estado === 'vencida' && item.renta?.fechaFinEstimada
    ? diasAtraso(item.renta.fechaFinEstimada)
    : 0;

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${cfg.border} rounded-xl shadow-sm p-4 flex flex-col gap-3`}>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
      </div>

      {/* Identidad */}
      <div>
        <p className="text-[11px] font-mono text-slate-400 leading-none">#{item.numeracion}</p>
        <p className="text-sm font-bold text-slate-800 leading-snug mt-0.5">{item.descripcion}</p>
      </div>

      {/* Contexto */}
      <div className="flex-1">
        {item.estado === 'disponible' ? (
          <p className="text-xs text-slate-400">{item.categoria ?? 'Sin categoría'}</p>
        ) : item.renta ? (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-700 truncate">{item.renta.clienteNombre}</p>
            {item.renta.fechaFinEstimada && (
              <p className={`text-[11px] ${item.estado === 'vencida' ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {item.estado === 'vencida' ? 'Venció' : 'Vence'}: {fmtFecha(item.renta.fechaFinEstimada)}
              </p>
            )}
            {item.renta.folio && (
              <p className="text-[11px] font-mono text-slate-400">{item.renta.folio}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* CTA — admin/secretaria ven todas; encargado solo ve las suyas */}
      {(item.estado === 'en-renta' || item.estado === 'vencida') && item.renta?.folio && onVerRenta && puedeVerRenta && (
        <button
          onClick={() => onVerRenta(item.renta!.folio!, item.estado as 'en-renta' | 'vencida')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors"
        >
          Ver renta
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
          </svg>
        </button>
      )}
    </div>
  );
}
