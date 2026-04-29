import { useState, useEffect, useRef, useMemo } from 'react';
import type { Equipo } from '../../types/equipo.types';
import type { UnidadDuracion, ItemMaquinaria } from '../../types/solicitud.types';
import { getRentaRate, descomponerDuracion, formatDesglose, esAdaptado } from '../../types/solicitud.types';

interface Props {
  equiposDisponibles: Equipo[];   // ya filtrados: liviana + activos + no en carrito
  isLoading:          boolean;
  onAdd:              (item: Omit<ItemMaquinaria, 'kind'>) => void;
}

const inputCls  = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50';
const labelCls  = 'block text-xs font-semibold text-slate-600 mb-1.5';
const selectCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all';

export default function MaquinariaPickerForm({ equiposDisponibles, isLoading, onAdd }: Props) {
  const [busqueda,     setBusqueda]     = useState('');
  const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);
  const d = new Date();
  const fechaInicio = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [duracion,     setDuracion]     = useState('');
  const [unidad,       setUnidad]       = useState<UnidadDuracion>('dias');
  const [dropdown,     setDropdown]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return equiposDisponibles
      .filter(e => !q || e.numeracion.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q))
      .slice(0, 8);
  }, [equiposDisponibles, busqueda]);

  const handleSelect = (e: Equipo) => {
    setSeleccionado(e);
    setBusqueda('');
    setDropdown(false);
    setError(null);
  };

  const handleClearSelection = () => {
    setSeleccionado(null);
    setError(null);
  };

  const handleAdd = () => {
    if (!seleccionado) { setError('Selecciona un equipo.'); return; }
    // fechaInicio siempre es hoy — no puede estar vacío
    const dur = parseInt(duracion);
    if (!dur || dur < 1) { setError('La duración debe ser al menos 1.'); return; }

    // Verificar que existen las tarifas requeridas por el desglose adaptativo
    const decomp = descomponerDuracion(fechaInicio, dur, unidad);
    const faltantes: string[] = [];
    if (decomp.meses   > 0 && seleccionado.rentaMes    === null) faltantes.push('mes');
    if (decomp.semanas > 0 && seleccionado.rentaSemana  === null) faltantes.push('semana');
    if (decomp.dias    > 0 && seleccionado.rentaDia     === null) faltantes.push('día');
    if (faltantes.length > 0) {
      setError(`Este equipo no tiene precio configurado para renta por ${faltantes.join(', ')}.`);
      return;
    }

    onAdd({ equipo: seleccionado, fechaInicio, duracion: dur, unidad });
    setSeleccionado(null);
    setDuracion('');
    setUnidad('dias');
    setError(null);
  };

  const desglosePreview = useMemo(() => {
    const dur = parseInt(duracion);
    if (!dur || dur < 1 || !seleccionado) return null;
    const decomp = descomponerDuracion(fechaInicio, dur, unidad);
    return esAdaptado(unidad, decomp) ? decomp : null;
  }, [duracion, unidad, fechaInicio, seleccionado]);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Agregar equipo liviano
      </div>

      {/* Equipo search */}
      <div className="mb-3" ref={containerRef}>
        <label className={labelCls}>Equipo <span className="text-red-400">*</span></label>
        {seleccionado ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50">
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{seleccionado.numeracion}
            </span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">
              {seleccionado.descripcion}
            </span>
            {seleccionado.categoria && (
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {seleccionado.categoria.nombre}
              </span>
            )}
            <button onClick={handleClearSelection}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors">
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
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setDropdown(true); setError(null); }}
              onFocus={() => setDropdown(true)}
              placeholder={isLoading ? 'Cargando equipos...' : 'Buscar por número o descripción...'}
              disabled={isLoading}
              className={`${inputCls} pl-8`}
            />
            {dropdown && !isLoading && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {resultados.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">
                    {busqueda ? 'Sin resultados.' : 'No hay equipos activos disponibles.'}
                  </div>
                ) : (
                  resultados.map(e => (
                    <button key={e.id} onMouseDown={() => handleSelect(e)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors group">
                      <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        #{e.numeracion}
                      </span>
                      <span className="text-xs font-medium text-slate-800 flex-1 truncate">{e.descripcion}</span>
                      {e.categoria && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{e.categoria.nombre}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date + duration */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className={labelCls}>Fecha de inicio</label>
          <div className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-500 bg-slate-50 flex items-center gap-2 select-none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="font-mono">{fechaInicio}</span>
            <span className="ml-auto text-[10px] text-slate-400 font-medium">Hoy</span>
          </div>
        </div>
        <div className="w-24">
          <label className={labelCls}>Duración <span className="text-red-400">*</span></label>
          <input type="number" value={duracion} min="1" step="1"
            onChange={e => { setDuracion(e.target.value); setError(null); }}
            placeholder="0"
            className={`${inputCls} font-mono`} />
        </div>
        <div className="w-28">
          <label className={labelCls}>Unidad</label>
          <select value={unidad} onChange={e => setUnidad(e.target.value as UnidadDuracion)}
            className={selectCls}>
            <option value="dias">días</option>
            <option value="semanas">semanas</option>
            <option value="meses">meses</option>
          </select>
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar
        </button>
      </div>

      {desglosePreview && (
        <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-amber-500 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-amber-700">
            Se factura como: <span className="font-semibold">{formatDesglose(desglosePreview)}</span>
          </span>
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-red-500 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}
    </div>
  );
}
