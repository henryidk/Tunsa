import { useMemo } from 'react';
import type { SolicitudRenta } from '../../types/solicitud-renta.types';

interface Props {
  solicitudes: SolicitudRenta[];
  value:       string | null;
  onChange:    (v: string | null) => void;
}

export default function FiltroProyecto({ solicitudes, value, onChange }: Props) {
  const { proyectos, hayIndependientes } = useMemo(() => {
    const map = new Map<string, string>();
    let sinProyecto = false;
    for (const s of solicitudes) {
      if (s.proyecto) map.set(s.proyecto.id, s.proyecto.nombre);
      else            sinProyecto = true;
    }
    return {
      proyectos:       Array.from(map.entries()),
      hayIndependientes: sinProyecto,
    };
  }, [solicitudes]);

  if (proyectos.length === 0) return null;

  return (
    <select
      value={value ?? 'todas'}
      onChange={e => {
        const v = e.target.value;
        onChange(v === 'todas' ? null : v === 'independientes' ? '' : v);
      }}
      className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
    >
      <option value="todas">Todos los proyectos</option>
      {hayIndependientes && <option value="independientes">Independientes</option>}
      {proyectos.map(([id, nombre]) => (
        <option key={id} value={id}>{nombre}</option>
      ))}
    </select>
  );
}
