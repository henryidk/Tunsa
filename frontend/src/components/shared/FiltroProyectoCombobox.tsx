import { useState, useRef, useEffect } from 'react';

interface ProyectoItem {
  id:     string;
  nombre: string;
}

interface Props {
  proyectos:         ProyectoItem[];
  hayIndependientes: boolean;
  value:             string | null;
  onChange:          (v: string | null) => void;
  fallbackLabel?:    string;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-indigo-700">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

const MAX_VISIBLE = 6;

export default function FiltroProyectoCombobox({ proyectos, hayIndependientes, value, onChange, fallbackLabel }: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  if (proyectos.length === 0 && !hayIndependientes) return null;

  const selectedProyecto = proyectos.find(p => p.id === value);
  const selectedLabel    = value === null
    ? null
    : value === ''
    ? 'Independientes'
    : (selectedProyecto?.nombre ?? fallbackLabel ?? null);

  const filteredProyectos = query.trim()
    ? proyectos.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
    : proyectos;

  const handleSelect = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative min-w-[200px]">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left transition-colors ${
          selectedLabel !== null
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
            : 'border-slate-200 bg-white text-slate-400 font-normal'
        }`}
      >
        <span className="flex-1 truncate">
          {selectedLabel ?? 'Todos los proyectos'}
        </span>

        {selectedLabel !== null && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-700 transition-colors cursor-pointer"
            aria-label="Limpiar filtro"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="10" y2="10"/>
              <line x1="10" y1="2" x2="2" y2="10"/>
            </svg>
          </span>
        )}

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[240px] z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Búsqueda */}
          <div className="px-3 pt-2.5 pb-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar proyecto..."
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Opciones */}
          <div className="overflow-y-auto max-h-[200px]">
            {!query.trim() && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors ${
                  value === null
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todos los proyectos
              </button>
            )}

            {hayIndependientes && !query.trim() && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors ${
                  value === ''
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Independientes
              </button>
            )}

            {filteredProyectos.slice(0, MAX_VISIBLE).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p.id)}
                className={`w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors ${
                  value === p.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {highlightMatch(p.nombre, query)}
              </button>
            ))}

            {filteredProyectos.length > MAX_VISIBLE && (
              <p className="px-4 py-2 text-xs text-slate-400 text-center border-t border-slate-100">
                +{filteredProyectos.length - MAX_VISIBLE} más · refina la búsqueda
              </p>
            )}

            {query.trim() && filteredProyectos.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
