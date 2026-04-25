import type { ItemRetorno, CargoRow } from './types';
import { formatQ } from './types';

interface Props {
  seleccionados: ItemRetorno[];
  cargosValidos: CargoRow[];
  totalCargosAd: number;
}

export default function PasoConfirmar({ seleccionados, cargosValidos, totalCargosAd }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-xs text-amber-800 leading-relaxed">
          Esta acción <span className="font-semibold">no se puede revertir</span>. El total final incluirá las lecturas registradas más las horas nocturnas del horómetro de devolución.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Equipos a devolver ({seleccionados.length})
        </p>
        <ul className="space-y-1.5">
          {seleccionados.map(it => (
            <li key={it.equipoId} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <svg className="shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
              <span className="text-xs font-mono text-slate-400">#{it.numeracion}</span>
              <span className="text-xs font-medium text-slate-800">{it.descripcion}</span>
              {it.conMartillo && <span className="text-[10px] text-orange-600">(+martillo)</span>}
            </li>
          ))}
        </ul>
      </div>

      {cargosValidos.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
          <span className="text-xs text-slate-600">
            {cargosValidos.length} cargo{cargosValidos.length > 1 ? 's' : ''} adicional{cargosValidos.length > 1 ? 'es' : ''}
          </span>
          <span className="text-xs font-bold text-amber-700">{formatQ(totalCargosAd)}</span>
        </div>
      )}
    </div>
  );
}
