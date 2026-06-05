import { useState, useMemo, useRef, useEffect } from 'react';
import type { Equipo } from '../../types/equipo.types';
import type { ExtraSeleccionado } from '../../types/solicitud-renta.types';
import type { UnidadDuracion } from '../../types/solicitud.types';
import { formatQ } from '../../types/solicitud.types';

export interface PesadaItemRetro {
  equipo:              Equipo;
  extrasSeleccionados: ExtraSeleccionado[];
  diasSolicitados?:    number;
  unidad?:             UnidadDuracion;
  horometroInicial?:   number;
}

interface Props {
  disponibles: Equipo[];
  isLoading:   boolean;
  indefinido:  boolean;
  item:        PesadaItemRetro | null;
  onAdd:       (item: PesadaItemRetro) => void;
  onQuitar:    () => void;
}

function calcTarifa(equipo: Equipo, extras: ExtraSeleccionado[]): number {
  return (equipo.rentaHora ?? 0) + extras.reduce((s, e) => s + e.rentaHora, 0);
}

export default function PesadaRetroactivaPickerSection({ disponibles, isLoading, indefinido, item, onAdd, onQuitar }: Props) {
  if (item) {
    return <EquipoAgregado item={item} indefinido={indefinido} onQuitar={onQuitar} />;
  }
  return (
    <PesadaPickerForm
      disponibles={disponibles}
      isLoading={isLoading}
      indefinido={indefinido}
      onAdd={onAdd}
    />
  );
}

// ── EquipoAgregado ────────────────────────────────────────────────────────────

function unidadLabel(dur: number, uni: UnidadDuracion): string {
  if (uni === 'dias')    return `${dur} día${dur !== 1 ? 's' : ''}`;
  if (uni === 'semanas') return `${dur} semana${dur !== 1 ? 's' : ''}`;
  return `${dur} mes${dur !== 1 ? 'es' : ''}`;
}

function EquipoAgregado({ item, indefinido, onQuitar }: { item: PesadaItemRetro; indefinido: boolean; onQuitar: () => void }) {
  const tarifa = calcTarifa(item.equipo, item.extrasSeleccionados);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Equipo</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Duración</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Horóm. inicial</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Tarifa</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">#{item.equipo.numeracion}</span>
                <span className="font-medium text-slate-700">{item.equipo.descripcion}</span>
              </div>
              {item.extrasSeleccionados.length > 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {item.extrasSeleccionados.map(e => `+ ${e.nombre}`).join(' · ')}
                </p>
              )}
            </td>
            <td className="px-3 py-3 whitespace-nowrap">
              {indefinido
                ? <span className="font-bold text-violet-600">∞</span>
                : <span className="text-slate-600">{item.diasSolicitados != null && item.unidad ? unidadLabel(item.diasSolicitados, item.unidad) : '—'}</span>}
            </td>
            <td className="px-3 py-3 font-mono text-slate-500">
              {item.horometroInicial != null ? item.horometroInicial.toLocaleString('es-GT') : <span className="text-slate-300">No registrado</span>}
            </td>
            <td className="px-3 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">{formatQ(tarifa)}/hr</td>
            <td className="px-3 py-3 text-right">
              <button onClick={onQuitar} className="text-slate-300 hover:text-red-400 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">1 equipo</span>
        <span className="text-[11px] text-slate-400">Facturación por horómetro real</span>
      </div>
    </div>
  );
}

// ── PesadaPickerForm ──────────────────────────────────────────────────────────

function PesadaPickerForm({ disponibles, isLoading, indefinido, onAdd }: {
  disponibles: Equipo[];
  isLoading:   boolean;
  indefinido:  boolean;
  onAdd:       (item: PesadaItemRetro) => void;
}) {
  const [busqueda,            setBusqueda]            = useState('');
  const [seleccionado,        setSeleccionado]        = useState<Equipo | null>(null);
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<ExtraSeleccionado[]>([]);
  const [dropdown,            setDropdown]            = useState(false);
  const [diasSolicitados,     setDiasSolicitados]     = useState(1);
  const [unidad,              setUnidad]              = useState<UnidadDuracion>('dias');
  const [horometroInicial,    setHorometroInicial]    = useState('');
  const [error,               setError]               = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return disponibles
      .filter(e => !q || e.numeracion.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q))
      .slice(0, 8);
  }, [disponibles, busqueda]);

  const tarifaPreview = seleccionado ? calcTarifa(seleccionado, extrasSeleccionados) : 0;

  const handleSelect = (e: Equipo) => {
    setSeleccionado(e);
    setExtrasSeleccionados([]);
    setBusqueda('');
    setDropdown(false);
    setError(null);
  };

  const toggleExtra = (extra: ExtraSeleccionado) => {
    setExtrasSeleccionados(prev => {
      const existe = prev.some(e => e.tipoExtraId === extra.tipoExtraId);
      return existe ? prev.filter(e => e.tipoExtraId !== extra.tipoExtraId) : [...prev, extra];
    });
  };

  const handleAdd = () => {
    if (!seleccionado) { setError('Selecciona un equipo.'); return; }
    if (!indefinido && diasSolicitados < 1) { setError('La duración debe ser al menos 1.'); return; }
    const horNum = horometroInicial.trim() !== '' ? parseFloat(horometroInicial) : undefined;
    if (horometroInicial.trim() !== '' && (isNaN(horNum!) || horNum! < 0)) {
      setError('El horómetro inicial debe ser un número válido.');
      return;
    }
    onAdd({
      equipo:              seleccionado,
      extrasSeleccionados,
      diasSolicitados:     indefinido ? undefined : diasSolicitados,
      unidad:              indefinido ? undefined : unidad,
      horometroInicial:    horNum,
    });
    setSeleccionado(null);
    setExtrasSeleccionados([]);
    setBusqueda('');
    setDiasSolicitados(1);
    setUnidad('dias');
    setHorometroInicial('');
    setError(null);
  };

  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Seleccionar equipo pesado
      </div>

      {/* Buscador */}
      <div className="mb-3" ref={containerRef}>
        <label className={labelCls}>Equipo <span className="text-red-400">*</span></label>
        {seleccionado ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50">
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{seleccionado.numeracion}
            </span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{seleccionado.descripcion}</span>
            <button onClick={() => { setSeleccionado(null); setExtrasSeleccionados([]); setError(null); }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setDropdown(true); setError(null); }}
              onFocus={() => setDropdown(true)}
              placeholder={isLoading ? 'Cargando equipos...' : 'Buscar por número o descripción...'}
              disabled={isLoading}
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:bg-slate-50"
            />
            {dropdown && !isLoading && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {resultados.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">
                    {busqueda ? 'Sin resultados.' : 'No hay equipos pesados disponibles.'}
                  </div>
                ) : resultados.map(e => (
                  <button key={e.id} onMouseDown={() => handleSelect(e)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors group">
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0">
                      #{e.numeracion}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-800 block truncate">{e.descripcion}</span>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {e.rentaHora != null && <span className="text-[10px] text-slate-400">{formatQ(e.rentaHora)}/hr</span>}
                        {e.extras.map(ex => (
                          <span key={ex.tipoExtraId} className="text-[10px] text-orange-500">+{ex.nombre}: {formatQ(ex.rentaHora)}/hr</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extras */}
      {seleccionado && seleccionado.extras.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Complementos disponibles</p>
          {seleccionado.extras.map(ex => {
            const activo = extrasSeleccionados.some(e => e.tipoExtraId === ex.tipoExtraId);
            return (
              <label key={ex.tipoExtraId} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={activo}
                  onChange={() => toggleExtra({ tipoExtraId: ex.tipoExtraId, nombre: ex.nombre, rentaHora: ex.rentaHora })}
                  className="w-3.5 h-3.5 accent-orange-500" />
                <span className="text-xs font-medium text-slate-700">{ex.nombre}</span>
                <span className="text-[10px] text-orange-600">+{formatQ(ex.rentaHora)}/hr</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Duración + horómetro inicial */}
      <div className="flex flex-wrap gap-3 items-end">
        {!indefinido && (
          <>
            <div className="w-20">
              <label className={labelCls}>Duración <span className="text-red-400">*</span></label>
              <input type="number" min="1" value={diasSolicitados}
                onChange={e => { setDiasSolicitados(Math.max(1, parseInt(e.target.value) || 1)); setError(null); }}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono" />
            </div>
            <div className="w-28">
              <label className={labelCls}>Unidad</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value as UnidadDuracion)}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="dias">días</option>
                <option value="semanas">semanas</option>
                <option value="meses">meses</option>
              </select>
            </div>
          </>
        )}

        <div className="w-36">
          <label className={labelCls}>
            Horómetro inicial
            <span className="ml-1 text-[10px] text-slate-400 font-normal">(opcional)</span>
          </label>
          <input type="number" min="0" step="0.1" value={horometroInicial}
            onChange={e => { setHorometroInicial(e.target.value); setError(null); }}
            placeholder="Ej: 12450"
            className="w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono placeholder-slate-300" />
        </div>

        <button onClick={handleAdd} disabled={!seleccionado}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Confirmar
        </button>
      </div>

      {seleccionado && (
        <p className="mt-2 text-[11px] text-slate-500">
          Tarifa efectiva: <span className="font-bold text-slate-700 font-mono">{formatQ(tarifaPreview)}/hr</span>
          {indefinido && <span className="ml-2 text-violet-500 font-medium">· Sin fecha límite</span>}
        </p>
      )}

      {error && (
        <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-[11px] text-amber-700 leading-snug">
          Se crearán registros de horómetro vacíos desde la fecha de inicio hasta hoy.
          El encargado asignado deberá llenarlos en la sección de horómetros.
        </p>
      </div>
    </div>
  );
}
