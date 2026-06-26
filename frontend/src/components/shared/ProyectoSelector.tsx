import { useState, useEffect, useRef } from 'react';
import type { ProyectoResumen } from '../../types/proyecto.types';

interface Props {
  proyectos: ProyectoResumen[];
  value:     string | null;
  onChange:  (v: string | null) => void;
}

const FolderIcon = ({ className = '' }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

export default function ProyectoSelector({ proyectos, value, onChange }: Props) {
  if (proyectos.length === 0) return null;

  const seleccionado = value ? (proyectos.find(p => p.id === value) ?? null) : null;

  /* ── Estado: proyecto seleccionado ──────────────────────────────────── */
  if (seleccionado) {
    return (
      <div className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <FolderIcon className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide leading-none mb-0.5">
            Proyecto asignado
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate">{seleccionado.nombre}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Quitar proyecto"
          className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    );
  }

  /* ── Estado: sin proyecto — dropdown custom ──────────────────────────── */
  return <ProyectoDropdown proyectos={proyectos} onChange={onChange} />;
}

function ProyectoDropdown({
  proyectos,
  onChange,
}: {
  proyectos: ProyectoResumen[];
  onChange:  (v: string | null) => void;
}) {
  const [open, setOpen]   = useState(false);
  const wrapperRef        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative mt-2">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-xl text-left transition-all ${
          open
            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          open ? 'bg-indigo-100' : 'bg-slate-100'
        }`}>
          <FolderIcon className={open ? 'text-indigo-500' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide leading-none mb-0.5 transition-colors ${
            open ? 'text-indigo-400' : 'text-slate-400'
          }`}>
            Proyecto · Opcional
          </p>
          <p className="text-sm text-slate-400">Seleccionar proyecto...</p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 transition-all duration-200 ${open ? 'rotate-180 text-indigo-400' : 'text-slate-300'}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 overflow-hidden">
          {proyectos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors ${
                i < proyectos.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <FolderIcon className="text-slate-300 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium truncate">{p.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
