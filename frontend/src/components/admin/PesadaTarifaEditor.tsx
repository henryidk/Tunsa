import type { ExtraSeleccionado } from '../../types/solicitud-renta.types';
import { formatQ } from '../../types/solicitud.types';

/** Celda de tarifa con indicador de override sobre catálogo (tachado + color). */
export function TarifaConOverride({ tarifa, catalogBase, tieneOverride }: {
  tarifa:        number;
  catalogBase:   number;
  tieneOverride: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {tieneOverride && (
        <span className="text-[10px] text-slate-400 line-through">{formatQ(catalogBase)}</span>
      )}
      <span className={`font-mono font-semibold ${tieneOverride ? 'text-indigo-600' : 'text-slate-700'}`}>
        {formatQ(tarifa)}/hr
      </span>
    </div>
  );
}

export function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

/** Panel inline para editar la tarifa base + cada complemento de un ítem pesado. */
export function PesadaTarifaEditorPanel({
  extrasSeleccionados, tieneOverride, baseInput, onBaseInputChange,
  extraInputs, onExtraInputChange, onAplicar, onCancelar, onRestablecer,
}: {
  extrasSeleccionados: ExtraSeleccionado[];
  tieneOverride:       boolean;
  baseInput:           string;
  onBaseInputChange:   (v: string) => void;
  extraInputs:         Record<string, string>;
  onExtraInputChange:  (tipoExtraId: string, v: string) => void;
  onAplicar:           () => void;
  onCancelar:          () => void;
  onRestablecer:       () => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Editar tarifas (Q/hora)</span>
        {tieneOverride && (
          <button onClick={onRestablecer} className="text-[11px] text-slate-500 hover:text-red-500 font-medium transition-colors">
            Restablecer a catálogo
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="w-28">
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Equipo base</label>
          <input
            type="number" min="0" step="0.01" value={baseInput}
            onChange={e => onBaseInputChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {extrasSeleccionados.map(e => (
          <div key={e.tipoExtraId} className="w-28">
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 truncate" title={e.nombre}>{e.nombre}</label>
            <input
              type="number" min="0" step="0.01" value={extraInputs[e.tipoExtraId] ?? ''}
              onChange={ev => onExtraInputChange(e.tipoExtraId, ev.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onAplicar} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
          Aplicar
        </button>
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}
