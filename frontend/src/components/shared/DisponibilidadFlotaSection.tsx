import { useState, useMemo } from 'react';
import { useFlotaDisponibilidad } from '../../hooks/useFlotaDisponibilidad';
import type { FlotaEstado } from '../../types/flota.types';
import type { TonoSistema } from '../../types/tono.types';
import { TONO_INDIGO } from '../../types/tono.types';
import FlotaEquipoCard from './FlotaEquipoCard';

type FiltroEstado = FlotaEstado | 'todos';
type FiltroTipo   = 'todos' | 'pesada' | 'liviana';

interface Props {
  tono?:            TonoSistema;
  onNavTo?:         (section: string, state?: { folio?: string }) => void;
  sectionActivas?:  string;
  sectionVencidas?: string;
}

const FILTRO_CFG: {
  key:           FiltroEstado;
  label:         string;
  activeBg:      string;
  activeBorder:  string;
  activeCount:   string;
  activeLabel:   string;
  inactiveCount: string;
}[] = [
  { key: 'todos',      label: 'Total',       activeBg: 'bg-slate-100',  activeBorder: 'border-slate-400',   activeCount: 'text-slate-800',   activeLabel: 'text-slate-600',   inactiveCount: 'text-slate-700' },
  { key: 'disponible', label: 'Disponibles', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400', activeCount: 'text-emerald-700', activeLabel: 'text-emerald-600', inactiveCount: 'text-slate-700' },
  { key: 'en-renta',   label: 'En renta',    activeBg: 'bg-indigo-50',  activeBorder: 'border-indigo-400',  activeCount: 'text-indigo-700',  activeLabel: 'text-indigo-600',  inactiveCount: 'text-slate-700' },
  { key: 'vencida',    label: 'Vencidas',    activeBg: 'bg-red-50',     activeBorder: 'border-red-400',     activeCount: 'text-red-700',     activeLabel: 'text-red-600',     inactiveCount: 'text-slate-700' },
];

const GRUPOS_ORDER: FlotaEstado[] = ['vencida', 'en-renta', 'disponible'];

const GRUPO_CFG: Record<FlotaEstado, { label: string; badgeCls: string }> = {
  vencida:    { label: 'Vencidas',    badgeCls: 'bg-red-100 text-red-700 border-red-200'            },
  'en-renta': { label: 'En renta',    badgeCls: 'bg-indigo-100 text-indigo-700 border-indigo-200'   },
  disponible: { label: 'Disponibles', badgeCls: 'bg-emerald-100 text-emerald-700 border-emerald-200'},
};

export default function DisponibilidadFlotaSection({
  tono = TONO_INDIGO,
  onNavTo,
  sectionActivas  = 'rentas-activas',
  sectionVencidas = 'vencidas',
}: Props) {
  const { items, isLoading, error, refresh } = useFlotaDisponibilidad();

  const [filtroEstado,   setFiltroEstado]   = useState<FiltroEstado>('todos');
  const [filtroTipo,     setFiltroTipo]     = useState<FiltroTipo>('todos');
  const [busqueda,       setBusqueda]       = useState('');
  const [filtroProyecto, setFiltroProyecto] = useState<string | null>(null);

  // Proyectos presentes en equipos en renta — derivado sin llamada extra
  const proyectosActivos = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string }>();
    items.forEach(i => {
      if (i.renta?.proyecto) map.set(i.renta.proyecto.id, i.renta.proyecto);
    });
    return [...map.values()];
  }, [items]);

  // Contadores siempre del dataset completo — no se ven afectados por búsqueda/tipo
  const counts = useMemo(() => ({
    todos:      items.length,
    disponible: items.filter(i => i.estado === 'disponible').length,
    'en-renta': items.filter(i => i.estado === 'en-renta').length,
    vencida:    items.filter(i => i.estado === 'vencida').length,
  }), [items]);

  // Items con filtros de tipo, búsqueda y proyecto (sin estado) — base para grupos
  const itemsBase = useMemo(() => {
    return items.filter(item => {
      if (filtroTipo === 'pesada'  && !item.esPesada) return false;
      if (filtroTipo === 'liviana' &&  item.esPesada) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        if (
          !item.numeracion.toLowerCase().includes(q) &&
          !item.descripcion.toLowerCase().includes(q) &&
          !(item.categoria ?? '').toLowerCase().includes(q) &&
          !(item.renta?.clienteNombre ?? '').toLowerCase().includes(q) &&
          !(item.renta?.folio ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (filtroProyecto !== null && item.renta?.proyecto?.id !== filtroProyecto) return false;
      return true;
    });
  }, [items, filtroTipo, busqueda, filtroProyecto]);

  // Items con todos los filtros — para vista plana al hacer drill-down por estado
  const itemsFiltrados = useMemo(
    () => filtroEstado === 'todos' ? itemsBase : itemsBase.filter(i => i.estado === filtroEstado),
    [itemsBase, filtroEstado],
  );

  const handleVerRenta = (folio: string, estado: 'en-renta' | 'vencida') => {
    onNavTo?.(estado === 'en-renta' ? sectionActivas : sectionVencidas, { folio });
  };

  const hayFiltroActivo = filtroEstado !== 'todos' || filtroTipo !== 'todos'
    || busqueda.trim().length > 0 || filtroProyecto !== null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Disponibilidad</h1>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {FILTRO_CFG.map(({ key, label, activeBg, activeBorder, activeCount, activeLabel, inactiveCount }) => {
          const count  = counts[key as keyof typeof counts];
          const activo = filtroEstado === key;
          return (
            <button
              key={key}
              onClick={() => setFiltroEstado(activo ? 'todos' : key)}
              title={activo ? 'Ver todos' : `Filtrar por ${label.toLowerCase()}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all shadow-sm ${
                activo
                  ? `${activeBg} ${activeBorder} shadow-md`
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <p className={`text-xl font-bold font-mono leading-none ${activo ? activeCount : inactiveCount}`}>
                  {isLoading ? '—' : count}
                </p>
                <p className={`text-xs font-semibold mt-0.5 ${activo ? activeLabel : 'text-slate-500'}`}>
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Búsqueda + filtro tipo */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por equipo, categoría o cliente..."
          className={`flex-1 min-w-[200px] sm:max-w-sm border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none ${tono.foco}`}
        />
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(['todos', 'pesada', 'liviana'] as FiltroTipo[]).map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
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

      {/* P3 — chips de proyectos */}
      {proyectosActivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-slate-400 self-center">Proyecto:</span>
          {proyectosActivos.map(p => (
            <button
              key={p.id}
              onClick={() => setFiltroProyecto(filtroProyecto === p.id ? null : p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filtroProyecto === p.id
                  ? `${tono.acento} border`
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
          <button onClick={refresh} className="ml-auto text-xs underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Contenido */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtroEstado === 'todos' ? (
        itemsBase.length === 0 ? (
          <EmptyState hayFiltro={hayFiltroActivo} />
        ) : (
          <div className="space-y-7">
            {GRUPOS_ORDER.map(estado => {
              const grupo = itemsBase.filter(i => i.estado === estado);
              if (grupo.length === 0) return null;
              const cfg = GRUPO_CFG[estado];
              return (
                <div key={estado}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badgeCls}`}>
                      {cfg.label} · {grupo.length}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grupo.map(item => (
                      <FlotaEquipoCard
                        key={item.equipoId}
                        item={item}
                        onVerRenta={handleVerRenta}
                        onProyectoClick={setFiltroProyecto}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        itemsFiltrados.length === 0 ? (
          <EmptyState hayFiltro={true} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsFiltrados.map(item => (
              <FlotaEquipoCard
                key={item.equipoId}
                item={item}
                onVerRenta={handleVerRenta}
                onProyectoClick={setFiltroProyecto}
              />
            ))}
          </div>
        )
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
