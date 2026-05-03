interface Props {
  paso:   1 | 2;
  pasos:  [string, string];
}

export default function PasoIndicador({ paso, pasos }: Props) {
  return (
    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-100 bg-slate-50">
      {pasos.map((label, idx) => {
        const n       = (idx + 1) as 1 | 2;
        const activo  = paso === n;
        const hecho   = paso > n;
        return (
          <div key={n} className="flex items-center gap-1.5">
            {idx > 0 && <div className={`h-px w-8 ${hecho ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
            <div className={`flex items-center gap-1.5 ${activo ? 'text-indigo-700' : hecho ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
                hecho
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                  : activo
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-300 text-slate-400'
              }`}>
                {hecho
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : n}
              </span>
              <span className="text-[11px] font-semibold">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
