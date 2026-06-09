import { useState } from 'react';
import type { ItemSolicitud, TarifasOverride } from '../../types/solicitud.types';
import {
  calcSubtotal, calcSubtotalConTarifasOverride,
  itemCartKey, getItemTarifaDisplay,
  formatQ, formatFechaCorta, unidadLabel,
  descomponerDuracion, formatDesglose,
} from '../../types/solicitud.types';

export interface SolicitudCartTableProps {
  items:           ItemSolicitud[];
  onRemove:        (idx: number) => void;
  effectiveTotal:  number;
  countMaquinaria: number;
  countGranel:     number;
  emptyMessage?:   string;
  overrides?:      Map<string, TarifasOverride>;
  onSetOverride?:  (key: string, val: TarifasOverride | null) => void;
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
                    overrideTarifas={overrides?.get(key)}
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
  item:              ItemSolicitud;
  onRemove:          () => void;
  overrideTarifas?:  TarifasOverride;
  onSetOverride?:    (val: TarifasOverride | null) => void;
}

function getCatalogRates(item: ItemSolicitud): TarifasOverride {
  if (item.kind === 'maquinaria') {
    return {
      dia:    item.equipo.rentaDia    ?? null,
      semana: item.equipo.rentaSemana ?? null,
      mes:    item.equipo.rentaMes    ?? null,
    };
  }
  if (item.kind === 'granel' && item.config) {
    return item.conMadera
      ? { dia: item.config.rentaDiaConMadera ?? null, semana: item.config.rentaSemanaConMadera ?? null, mes: item.config.rentaMesConMadera ?? null }
      : { dia: item.config.rentaDia          ?? null, semana: item.config.rentaSemana          ?? null, mes: item.config.rentaMes          ?? null };
  }
  return { dia: null, semana: null, mes: null };
}

function parseRate(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) || n < 0 ? null : n;
}

function SolicitudCartRow({ item, onRemove, overrideTarifas, onSetOverride }: SolicitudCartRowProps) {
  const [editing,  setEditing]  = useState(false);
  const [inputs,   setInputs]   = useState({ dia: '', semana: '', mes: '' });

  const hasSchedule                        = item.kind !== 'pesada' && item.duracion != null;
  const { tarifa: catalogTarifa, isAdaptive } = getItemTarifaDisplay(item);
  const catalog                            = getCatalogRates(item);

  const displaySubtotal = overrideTarifas !== undefined
    ? calcSubtotalConTarifasOverride(item, overrideTarifas)
    : calcSubtotal(item);

  const previewSubtotal = editing && item.kind !== 'pesada' && item.duracion
    ? calcSubtotalConTarifasOverride(item, {
        dia:    parseRate(inputs.dia),
        semana: parseRate(inputs.semana),
        mes:    parseRate(inputs.mes),
      })
    : 0;

  const startEdit = () => {
    const src = overrideTarifas ?? catalog;
    setInputs({
      dia:    String(src.dia    ?? ''),
      semana: String(src.semana ?? ''),
      mes:    String(src.mes    ?? ''),
    });
    setEditing(true);
  };

  const commitEdit = () => {
    onSetOverride?.({
      dia:    parseRate(inputs.dia),
      semana: parseRate(inputs.semana),
      mes:    parseRate(inputs.mes),
    });
    setEditing(false);
  };

  const decomp = hasSchedule && item.unidad && item.duracion
    ? descomponerDuracion(item.fechaInicio, item.duracion, item.unidad)
    : null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">

      {/* Col 1: Equipo / Instrumento */}
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
          ? isAdaptive && item.unidad && decomp
            ? <span className="font-medium text-amber-600">
                {formatDesglose(decomp)}
              </span>
            : unidadLabel(item.duracion!, item.unidad!)
          : <span className="font-semibold text-violet-600">Indefinido</span>}
      </td>

      {/* Col 4: Tarifa — 3 campos editables */}
      <td className="px-3 py-3 text-xs">
        {!hasSchedule ? (
          <span className="text-slate-300">—</span>
        ) : editing ? (
          /* ── Modo edición: 3 inputs ── */
          <div className="space-y-1 min-w-[130px]">
            {([ ['dia', '/día'], ['semana', '/sem'], ['mes', '/mes'] ] as const).map(([unit, label]) => (
              <div key={unit} className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 w-8 text-right flex-shrink-0">{label}</span>
                <span className="text-[10px] text-slate-400">Q</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs[unit]}
                  onChange={e => setInputs(prev => ({ ...prev, [unit]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                  className="w-16 px-1 py-0.5 text-xs font-mono border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={commitEdit}
                className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Aplicar
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
            <div className="text-[10px] font-mono text-indigo-500">
              → {formatQ(previewSubtotal)}
            </div>
          </div>
        ) : overrideTarifas !== undefined ? (
          /* ── Override activo: mostrar las 3 tarifas ── */
          <div className="flex items-start gap-1.5">
            <div className="space-y-0.5">
              {([ ['dia', '/día'], ['semana', '/sem'], ['mes', '/mes'] ] as const).map(([unit, label]) => {
                const val     = overrideTarifas[unit];
                const catVal  = catalog[unit];
                const changed = val !== catVal;
                return val != null ? (
                  <div key={unit} className="flex items-baseline gap-1">
                    <span className="text-[9px] text-slate-400 w-7 text-right">{label}</span>
                    <span className={`font-mono text-[11px] font-bold ${changed ? 'text-indigo-600' : 'text-slate-500'}`}>
                      {formatQ(val)}
                    </span>
                    {changed && catVal != null && (
                      <span className="text-[9px] font-mono text-slate-300 line-through">{formatQ(catVal)}</span>
                    )}
                  </div>
                ) : null;
              })}
            </div>
            <div className="flex flex-col gap-0.5 ml-0.5">
              <button
                onClick={startEdit}
                title="Editar tarifas"
                className="p-0.5 rounded text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                onClick={() => onSetOverride?.(null)}
                title="Restablecer tarifas"
                className="p-0.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* ── Sin override: tarifa de catálogo ── */
          <div className="flex items-center gap-1.5">
            <div>
              {isAdaptive && (
                <div className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide mb-0.5">Adapt.</div>
              )}
              <span className="font-mono text-slate-600">
                {catalogTarifa !== null
                  ? <>{formatQ(catalogTarifa)}<span className="text-slate-400">{item.unidad ? `/${item.unidad === 'dias' ? 'día' : item.unidad === 'semanas' ? 'sem' : 'mes'}` : ''}{item.kind === 'granel' ? '/u' : ''}</span></>
                  : <span className="text-slate-300">—</span>}
              </span>
            </div>
            {onSetOverride && (
              <button
                onClick={startEdit}
                title="Personalizar tarifas"
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

      {/* Col 5: Subtotal */}
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {hasSchedule ? (
          <span className={`font-mono font-bold ${overrideTarifas !== undefined ? 'text-indigo-600' : 'text-slate-800'}`}>
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
