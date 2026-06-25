import type { ProyectoResumen } from '../../types/proyecto.types';

interface Props {
  proyecto:   ProyectoResumen | null;
  className?: string;
  onClick?:   () => void;
}

export default function ProyectoBadge({ proyecto, className = '', onClick }: Props) {
  if (!proyecto) return null;

  const inner = (
    <>
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M2 3.5A1.5 1.5 0 013.5 2h2.764c.958 0 1.76.56 2.134 1.373L8.75 4.5H12.5A1.5 1.5 0 0114 6v6.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
      </svg>
      <span className="truncate max-w-[140px]">{proyecto.nombre}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {inner}
    </span>
  );
}
