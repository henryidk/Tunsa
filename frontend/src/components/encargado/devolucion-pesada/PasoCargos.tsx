import type { CargoRow } from './types';
import { formatQ } from './types';

interface Props {
  hayCargos:        boolean;
  onToggle:         () => void;
  cargos:           CargoRow[];
  totalCargosAd:    number;
  onAgregar:        () => void;
  onEliminar:       (idx: number) => void;
  onActualizar:     (idx: number, campo: keyof CargoRow, valor: string) => void;
}

export default function PasoCargos({ hayCargos, onToggle, cargos, totalCargosAd, onAgregar, onEliminar, onActualizar }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Registra cargos adicionales por daños, faltantes u otras condiciones del equipo. Se suman al costo calculado por horómetro.
      </p>
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={onToggle}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${hayCargos ? 'bg-slate-700' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hayCargos ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-sm font-medium text-slate-700">
          {hayCargos ? 'Hay cargos adicionales' : 'Sin cargos adicionales'}
        </span>
      </label>
      {hayCargos && (
        <div className="space-y-3">
          {cargos.map((cargo, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Descripción</label>
                <input
                  type="text"
                  value={cargo.descripcion}
                  onChange={e => onActualizar(idx, 'descripcion', e.target.value)}
                  placeholder="Ej: Daño en panel lateral"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder-slate-300"
                />
              </div>
              <div className="w-28">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Monto (Q)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cargo.monto}
                  onChange={e => onActualizar(idx, 'monto', e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              {cargos.length > 1 && (
                <button
                  onClick={() => onEliminar(idx)}
                  className="mb-0.5 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            onClick={onAgregar}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar cargo
          </button>
          {totalCargosAd > 0 && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-500 font-medium">Total cargos adicionales</span>
              <span className="text-sm font-bold text-slate-800">{formatQ(totalCargosAd)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
