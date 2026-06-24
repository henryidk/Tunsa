import type { ProyectoResumen } from '../../types/proyecto.types';

interface Props {
  proyectos: ProyectoResumen[];
  value:     string | null;
  onChange:  (v: string | null) => void;
}

export default function ProyectoSelector({ proyectos, value, onChange }: Props) {
  if (proyectos.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-3 px-1">
      <label className="text-xs font-medium text-slate-500 whitespace-nowrap flex-shrink-0">
        Proyecto
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
      >
        <option value="">— Sin proyecto —</option>
        {proyectos.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>
    </div>
  );
}
