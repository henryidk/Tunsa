import { useState, useMemo } from 'react';
import { useFlotaDisponibilidad } from '../../hooks/useFlotaDisponibilidad';
import type { FlotaEstado } from '../../types/flota.types';
import FlotaEquipoCard from './FlotaEquipoCard';

type FiltroEstado = FlotaEstado | 'todos';
type FiltroTipo   = 'todos' | 'pesada' | 'liviana';

interface Props {
  onNavTo?: (section: string, state?: { folio?: string }) => void;
}

const FILTRO_CFG: { key: FiltroEstado; label: string; activeClass: string; countClass: string }[] = [
  { key: 'todos',       label: 'Total',       activeClass: 'bg-slate-800 text-white border-slate-800',         countClass: 'text-slate-800' },
  { key: 'disponible',  label: 'Disponibles', activeClass: 'bg-emerald-600 text-white border-emerald-600',     countClass: 'text-emerald-700' },
  { key: 'en-renta',    label: 'En renta',    activeClass: 'bg-indigo-600 text-white border-indigo-600',       countClass: 'text-indigo-700' },
  { key: 'vencida',     label: 'Vencidas',    activeClass: 'bg-red-600 text-white border-red-600',             countClass: 'text-red-700' },
];

export default function DisponibilidadFlotaSection({ onNavTo }: Props) {
  const { items, isLoading, error, refresh } = useFlotaDisponibilidad();

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroTipo,   setFiltroTipo]   = useState<FiltroTipo>('todos');
  const [busqueda,     setBusqueda]     = useState('');

  const counts = useMemo(() => ({
    todos:      items.length,
    disponible: items.filter(i => i.estado === 'disponible').length,
    'en-renta': items.filter(i => i.estado === 'en-renta').length,
    vencida:    items.filter(i => i.estado === 'vencida').length,
  }), [items]);

  const itemsFiltrados = useMemo(() => {
    return items.filter(item => {
      if (filtroEstado !== 'todos' && item.estado !== filtroEstado) return false;
      if (filtroTipo === 'pesada'  && !item.esPesada) return false;
      if (filtroTipo === 'liviana' &&  item.esPesada) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        return item.numeracion.toLowerCase().includes(q)
            || item.descripcion.toLowerCase().includes(q)
            || (item.categoria ?? '').toLowerCase().includes(q)
            || (item.renta?.clienteNombre ?? '').toLowerCase().includes(q)
            || (item.renta?.folio ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, filtroEstado, filtroTipo, busqueda]);

  const handleVerRenta = (folio: string, estado: 'en-renta' | 'vencida') => {
    onNavTo?.(estado === 'en-renta' ? 'activas' : 'vencidas', { folio });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Disponibilidad de Flota</h1>
          <p className="text-sm text-slate-500 mt-1">Estado actual de todos los equipos activos</p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-500 transition-colors disabled:opacity-40"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isLoading ? 'animate-spin' : ''}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* Filtros de estado (stat cards clicables) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {FILTRO_CFG.map(({ key, label, activeClass, countClass }) => {
          const count  = counts[key as keyof typeof counts];
          const activo = filtroEstado === key;
          return (
            <button
              key={key}
              onClick={() => setFiltroEstado(activo ? 'todos' : key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all shadow-sm ${
                activo
                  ? `${activeClass} shadow-md`
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <p className={`text-xl font-bold font-mono leading-none ${activo ? 'text-white' : countClass}`}>
                  {isLoading ? '—' : count}
                </p>
                <p className={`text-[11px] font-semibold mt-0.5 ${activo ? 'text-white/80' : 'text-slate-500'}`}>
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Búsqueda + filtro de tipo */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por equipo, categoría o cliente..."
          className="flex-1 min-w-[200px] sm:max-w-sm border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(['todos', 'pesada', 'liviana'] as FiltroTipo[]).map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${
                filtroTipo === tipo
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tipo === 'todos' ? 'Todas' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
          <button onClick={refresh} className="ml-auto text-xs underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <EmptyState hayFiltro={filtroEstado !== 'todos' || filtroTipo !== 'todos' || busqueda.trim().length > 0} />
      ) : (
        <div className="space-y-2.5">
          {itemsFiltrados.map(item => (
            <FlotaEquipoCard
              key={item.equipoId}
              item={item}
              onVerRenta={handleVerRenta}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hayFiltro }: { hayFiltro: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      <p className="text-sm font-medium">
        {hayFiltro ? 'Sin resultados para ese filtro' : 'Sin equipos registrados'}
      </p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        {hayFiltro
          ? 'Prueba cambiando el filtro o la búsqueda.'
          : 'Los equipos activos del catálogo aparecerán aquí.'}
      </p>
    </div>
  );
}
