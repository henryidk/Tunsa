import type { Paso } from './types';

const PASOS = [
  { n: 1, label: 'Equipos' },
  { n: 2, label: 'Cargos' },
  { n: 3, label: 'Resumen' },
  { n: 4, label: 'Confirmar' },
];

export default function PasoIndicador({ paso }: { paso: Paso }) {
  const pasoActual = paso === 'resultado' ? 4 : paso;
  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-100 bg-slate-50">
      {PASOS.map((p, idx) => (
        <div key={p.n} className="flex items-center gap-1.5">
          {idx > 0 && <div className={`h-px w-6 ${pasoActual > p.n ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
          <div className={`flex items-center gap-1 ${
            pasoActual === p.n ? 'text-indigo-700' : pasoActual > p.n ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
              pasoActual > p.n
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : pasoActual === p.n
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
            }`}>
              {pasoActual > p.n
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : p.n}
            </span>
            <span className="text-[11px] font-semibold">{p.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
