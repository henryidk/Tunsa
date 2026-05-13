import type { PasoMeta, PasoKey } from './types';

interface Props {
  secuencia:   PasoMeta[];
  pasoActual:  PasoKey;
}

export default function PasoIndicador({ secuencia, pasoActual }: Props) {
  const currentIdx = secuencia.findIndex(p => p.key === pasoActual);
  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-100 bg-slate-50">
      {secuencia.map((p, idx) => (
        <div key={p.key} className="flex items-center gap-1.5">
          {idx > 0 && <div className={`h-px w-6 ${idx <= currentIdx ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
          <div className={`flex items-center gap-1 ${
            idx === currentIdx ? 'text-indigo-700' : idx < currentIdx ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
              idx < currentIdx
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : idx === currentIdx
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
            }`}>
              {idx < currentIdx
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : idx + 1}
            </span>
            <span className="text-[11px] font-semibold">{p.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
