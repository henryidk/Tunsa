interface Proyecto {
  id:     string;
  nombre: string;
}

interface Props {
  proyectos:         Proyecto[];
  hayIndependientes: boolean;
  value:             string | null;
  onChange:          (v: string | null) => void;
}

export default function FiltroProyecto({ proyectos, hayIndependientes, value, onChange }: Props) {
  if (proyectos.length === 0 && !hayIndependientes) return null;

  const chips: { key: string | null; label: string }[] = [
    { key: null,  label: 'Todos' },
    ...(hayIndependientes ? [{ key: '', label: 'Independientes' }] : []),
    ...proyectos.map(p => ({ key: p.id, label: p.nombre })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => {
        const active = value === chip.key;
        return (
          <button
            key={chip.key ?? '__todos__'}
            onClick={() => onChange(chip.key)}
            className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
              active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
