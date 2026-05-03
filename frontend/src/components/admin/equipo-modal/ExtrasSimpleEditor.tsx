import { useState } from 'react';

export interface ExtraLocal {
  localId:     string;
  tipoExtraId?: string;
  nombre:      string;
  rentaHora:   string;
}

interface Props {
  extras:        ExtraLocal[];
  disabled:      boolean;
  onAgregar:     (nombre: string, rentaHora: string) => void;
  onRemove:      (localId: string) => void;
  onUpdatePrice: (localId: string, precio: string) => void;
}

export default function ExtrasSimpleEditor({ extras, disabled, onAgregar, onRemove, onUpdatePrice }: Props) {
  const [nombre,    setNombre]    = useState('');
  const [precio,    setPrecio]    = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const handleAgregar = () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim)           { setErrorForm('El nombre es obligatorio.'); return; }
    if (nombreTrim.length > 60) { setErrorForm('Máximo 60 caracteres.'); return; }
    onAgregar(nombreTrim, precio);
    setNombre('');
    setPrecio('');
    setErrorForm(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAgregar(); }
  };

  return (
    <div className="space-y-2">
      {extras.length === 0 && (
        <p className="text-xs text-slate-400 py-1">Sin complementos. Agrega uno abajo.</p>
      )}

      {extras.map(extra => (
        <div key={extra.localId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-indigo-50 border-indigo-200">
          <span className="flex-1 text-sm font-medium text-indigo-800 truncate min-w-0">{extra.nombre}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-500 font-mono">Q</span>
            <input
              type="text"
              inputMode="decimal"
              value={extra.rentaHora}
              onChange={e => onUpdatePrice(extra.localId, e.target.value)}
              disabled={disabled}
              placeholder="0.00"
              className="w-20 border border-slate-200 rounded-md px-2 py-1 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-400">/hr</span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(extra.localId)}
            disabled={disabled}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}

      {/* Formulario agregar */}
      <div className="border border-dashed border-slate-300 rounded-lg px-3 py-3 bg-slate-50 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorForm(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Nombre del complemento"
            maxLength={60}
            disabled={disabled}
            className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:opacity-60 placeholder-slate-400"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-slate-400 font-mono">Q</span>
            <input
              type="text"
              inputMode="decimal"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
              disabled={disabled}
              className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:opacity-60 placeholder-slate-400"
            />
            <span className="text-[10px] text-slate-400">/hr</span>
          </div>
          <button
            type="button"
            onClick={handleAgregar}
            disabled={disabled || !nombre.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar
          </button>
        </div>
        {errorForm && <p className="text-[11px] text-red-600 font-medium">{errorForm}</p>}
      </div>
    </div>
  );
}
