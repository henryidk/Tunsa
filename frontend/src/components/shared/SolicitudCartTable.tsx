import { useState } from 'react';
import type { ItemSolicitud } from '../../types/solicitud.types';
import {
  calcSubtotal, calcSubtotalConTarifaOverride,
  itemCartKey, getItemTarifaDisplay,
  formatQ, formatFechaCorta, unidadLabel, rateSuffix,
  descomponerDuracion, formatDesglose,
} from '../../types/solicitud.types';

export interface SolicitudCartTableProps {
  items:           ItemSolicitud[];
  onRemove:        (idx: number) => void;
  effectiveTotal:  number;
  countMaquinaria: number;
  countGranel:     number;
  emptyMessage?:   string;
  overrides?:      Map<string, number>;
  onSetOverride?:  (key: string, val: number | null) => void;
}

export function SolicitudCartTable({
  items, onRemove, effectiveTotal, countMaquinaria, countGranel,
  emptyMessage = 'Aún no has agregado equipos',
  overrides, onSetOverride,
}: SolicitudCartTableProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs text-slate-400 font-medium">
          Ítems ({items.length})
        </span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Equipo / Instrumento', 'Inicio', 'Duración', 'Tarifa', 'Subtotal', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M22 12H18L15 21L9 3L6 12H2"/>
                    </svg>
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const key = itemCartKey(item);
                return (
                  <SolicitudCartRow
                    key={key}
                    item={item}
                    onRemove={() => onRemove(idx)}
                    overrideTarifa={overrides?.get(key)}
                    onSetOverride={onSetOverride ? (val) => onSetOverride(key, val) : undefined}
                  />
                );
              })
            )}
          </tbody>
        </table>

        {items.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {[
                countMaquinaria > 0 ? `${countMaquinaria} equipo${countMaquinaria > 1 ? 's' : ''}` : null,
                countGranel > 0 ? `${countGranel} granel` : null,
              ].filter(Boolean).join(' · ')}
            </span>
            <span className="text-xs font-bold text-slate-700 font-mono">
              Total: {formatQ(effectiveTotal)}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ── CartRow ───────────────────────────────────────────────────────────────────

interface SolicitudCartRowProps {
  item:            ItemSolicitud;
  onRemove:        () => void;
  overrideTarifa?: number;
  onSetOverride?:  (val: number | null) => void;
}

function SolicitudCartRow({ item, onRemove, overrideTarifa, onSetOverride }: SolicitudCartRowProps) {
  const [editing,  setEditing]  = useState(false);
  const [inputVal, setInputVal] = useState('');

  const hasSchedule              = item.kind !== 'pesada' && item.duracion != null;
  const { tarifa: catalogTarifa, isAdaptive } = getItemTarifaDisplay(item);
  const suffix                   = hasSchedule && item.unidad
    ? `${rateSuffix(item.unidad)}${item.kind === 'granel' ? '/u' : ''}`
    : '';

  const displaySubtotal = overrideTarifa !== undefined
    ? calcSubtotalConTarifaOverride(item, overrideTarifa)
    : calcSubtotal(item);

  const startEdit = () => {
    setInputVal(String(overrideTarifa ?? catalogTarifa ?? 0));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseFloat(inputVal.replace(',', '.'));
    if (!isNaN(num) && num >= 0) onSetOverride?.(num);
    setEditing(false);
  };

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">

      {/* Col 1: Equipo / Instrumento — cantidad inline para granel */}
      <td className="px-3 py-3">
        {item.kind === 'maquinaria' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{item.equipo.numeracion}
            </span>
            <span className="text-xs font-medium text-slate-800 truncate max-w-[150px]">
              {item.equipo.descripcion}
            </span>
          </div>
        )}
        {item.kind === 'granel' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              Granel
            </span>
            <span className="text-xs font-medium text-slate-800">{item.tipoLabel}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              × {item.cantidad.toLocaleString('es-GT')} u
            </span>
          </div>
        )}
      </td>

      {/* Col 2: Inicio */}
      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatFechaCorta(item.fechaInicio)}
      </td>

      {/* Col 3: Duración */}
      <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
        {hasSchedule
          ? isAdaptive && item.unidad
            ? <span className="font-medium text-amber-600">
                {formatDesglose(descomponerDuracion(item.fechaInicio, item.duracion!, item.unidad))}
              </span>
            : unidadLabel(item.duracion!, item.unidad!)
          : <span className="font-semibold text-violet-600">Indefinido</span>}
      </td>

      {/* Col 4: Tarifa — editable por admin cuando onSetOverride está presente */}
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {!hasSchedule ? (
          <span className="text-slate-300">—</span>
        ) : editing ? (
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Q</span>
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={commitEdit}
              className="w-20 px-1.5 py-0.5 text-xs font-mono border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="text-[10px] text-slate-400">{suffix}</span>
          </div>
        ) : overrideTarifa !== undefined ? (
          /* Override activo */
          <div className="flex items-center gap-1.5">
            <div>
              <div className="font-mono font-bold text-indigo-600">
                {formatQ(overrideTarifa)}<span className="font-normal text-indigo-400">{suffix}</span>
              </div>
              {catalogTarifa !== null && (
                <div className="text-[10px] font-mono text-slate-400 line-through leading-none">
                  {formatQ(catalogTarifa)}{suffix}
                </div>
              )}
            </div>
            <button
              onClick={() => onSetOverride?.(null)}
              title="Restablecer precio"
              className="p-0.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          /* Sin override: tarifa de catálogo + badge "Adapt." si aplica precio adaptativo */
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-slate-600">
              {catalogTarifa !== null
                ? <>{formatQ(catalogTarifa)}<span className="text-slate-400">{suffix}</span></>
                : <span className="text-slate-300">—</span>}
            </span>
            {onSetOverride && (
              <button
                onClick={startEdit}
                title="Personalizar precio"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex-shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </td>

      {/* Col 5: Subtotal — solo lectura, recalculado */}
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {hasSchedule ? (
          <span className={`font-mono font-bold ${overrideTarifa !== undefined ? 'text-indigo-600' : 'text-slate-800'}`}>
            {formatQ(displaySubtotal)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Col 6: Quitar */}
      <td className="px-3 py-3">
        <button
          onClick={onRemove}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  );
}
