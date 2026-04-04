// BitacorasSection.tsx — registro de cambios del sistema (cursor-based pagination)

import { useState, useEffect, useCallback, useRef } from 'react';
import { equiposService } from '../../../services/equipos.service';
import type { BitacoraEntry, BitacoraStats } from '../../../services/equipos.service';

const CAMPO_LABEL: Record<string, string> = {
  // equipos
  descripcion:  'Descripción',
  categoria:    'Categoría',
  serie:        'Serie',
  cantidad:     'Cantidad',
  fechaCompra:  'Fecha de compra',
  montoCompra:  'Monto de compra',
  tipo:         'Tipo',
  rentaDia:     'Renta por día',
  rentaSemana:  'Renta por semana',
  rentaMes:     'Renta por mes',
  numeracion:   'Numeración',
  // clientes / usuarios
  nombre:          'Nombre',
  username:        'Usuario',
  telefono:        'Teléfono',
  dpi:             'DPI',
  reset_password:  'Reseteo de contraseña',
  desactivar:      'Desactivación',
  activar:         'Activación',
  // acciones genéricas
  eliminacion: 'Eliminación',
  creacion:    'Creación',
  renombrado:  'Renombrado',
  crear:       'Creación',
  documento:   'Documentación',
};

const CAMPOS_MONEDA = new Set(['montoCompra', 'rentaDia', 'rentaSemana', 'rentaMes']);

const CAMPO_BADGE: Record<string, string> = {
  reset_password: 'bg-amber-50 text-amber-700',
  desactivar:     'bg-red-50 text-red-700',
  activar:        'bg-green-50 text-green-700',
  eliminacion:    'bg-red-50 text-red-700',
  creacion:       'bg-green-50 text-green-700',
  crear:          'bg-green-50 text-green-700',
  documento:      'bg-cyan-50 text-cyan-700',
};

const MODULO_CONFIG: Record<string, { label: string; badge: string; stat: string }> = {
  equipo:      { label: 'Equipo',    badge: 'bg-blue-50 text-blue-700',       stat: 'text-blue-600' },
  usuario:     { label: 'Usuario',   badge: 'bg-violet-50 text-violet-700',   stat: 'text-violet-600' },
  categoria:   { label: 'Categoría', badge: 'bg-emerald-50 text-emerald-700', stat: 'text-emerald-600' },
  tipo_equipo: { label: 'Tipo',      badge: 'bg-orange-50 text-orange-700',   stat: 'text-orange-600' },
  cliente:     { label: 'Cliente',   badge: 'bg-cyan-50 text-cyan-700',       stat: 'text-cyan-600' },
};

function moduloDisplay(modulo: string) {
  return MODULO_CONFIG[modulo] ?? { label: modulo, badge: 'bg-slate-100 text-slate-600', stat: 'text-slate-600' };
}

function formatValor(campo: string, valor: string | null): string {
  if (valor === null) return campo === 'categoria' ? 'Sin categoría' : '—';
  if (CAMPOS_MONEDA.has(campo)) {
    const n = parseFloat(valor);
    return isNaN(n) ? valor : `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (campo === 'tipo') return valor.replace(/_/g, ' ');
  if (campo === 'fechaCompra') {
    const d = new Date(valor);
    return isNaN(d.getTime()) ? valor : d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return valor;
}

function formatFechaHora(iso: string) {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora:  d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function BitacorasSection() {
  const [entradas,    setEntradas]    = useState<BitacoraEntry[]>([]);
  const [stats,       setStats]       = useState<BitacoraStats | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');

  // Ref para debounce del search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Cargar stats una sola vez al montar
  useEffect(() => {
    equiposService.getBitacoraStats()
      .then(s => setStats(s))
      .catch(() => {/* stats son decorativas, no bloquear */});
  }, []);

  // Cargar primera página cuando cambian los filtros
  const loadFirstPage = useCallback(async (modulo: string, search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await equiposService.getBitacoras({
        modulo:  modulo  || undefined,
        search:  search  || undefined,
      });
      setEntradas(result.data);
      setNextCursor(result.nextCursor);
    } catch {
      setError('No se pudo cargar el registro de cambios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(filtroModulo, debouncedSearch);
  }, [filtroModulo, debouncedSearch, loadFirstPage]);

  // Debounce del input de búsqueda (400ms)
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 400);
  };

  // Limpiar timer al desmontar
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  // Cargar siguiente página (cursor)
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await equiposService.getBitacoras({
        cursor:  nextCursor,
        modulo:  filtroModulo || undefined,
        search:  debouncedSearch || undefined,
      });
      setEntradas(prev => [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
    } catch {
      // no bloquear — el usuario puede reintentar
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setSearch('');
    setDebouncedSearch('');
    setFiltroModulo('');
  };

  const modulosPresentes = stats
    ? [
        ...Object.keys(MODULO_CONFIG).filter(m => stats.porModulo[m]),
        ...Object.keys(stats.porModulo).filter(m => !MODULO_CONFIG[m]),
      ]
    : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Bitácoras</h1>
        <p className="text-sm text-slate-500 mt-1">Registro de cambios realizados en el sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total de registros', value: stats?.total  ?? '—', color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'Cambios hoy',        value: stats?.hoy    ?? '—', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ...modulosPresentes.map(m => {
            const cfg = moduloDisplay(m);
            return {
              label: `En ${cfg.label.toLowerCase()}s`,
              value: stats?.porModulo[m] ?? 0,
              color: cfg.stat,
              bg:    cfg.badge.split(' ')[0],
            };
          }),
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${s.bg} mb-2`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={s.color}>
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Filtro módulo */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {[
            { id: '', label: 'Todos', count: stats?.total ?? null },
            ...modulosPresentes.map(m => ({
              id:    m,
              label: `${moduloDisplay(m).label}s`,
              count: stats?.porModulo[m] ?? null,
            })),
          ].map(t => (
            <button key={t.id} onClick={() => setFiltroModulo(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-r border-slate-200 last:border-0 transition-colors ${
                filtroModulo === t.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {t.label}
              {t.count !== null && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  filtroModulo === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre, campo, usuario..."
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[260px]"
          />
        </div>

        {(search || filtroModulo) && (
          <button onClick={handleLimpiarFiltros}
            className="text-xs text-slate-500 hover:text-slate-700 underline transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Fecha y hora', 'Módulo', 'Entidad', 'Cambio', 'Anterior', 'Nuevo', 'Realizado por'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Cargando bitácoras...</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
              )}
              {!isLoading && !error && entradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    {search || filtroModulo ? 'No se encontraron resultados.' : 'No hay cambios registrados aún.'}
                  </td>
                </tr>
              )}
              {!isLoading && !error && entradas.map(e => {
                const { fecha, hora } = formatFechaHora(e.createdAt);
                const campoBadge = CAMPO_BADGE[e.campo] ?? 'bg-indigo-50 text-indigo-700';
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-700">{fecha}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{hora}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${moduloDisplay(e.modulo).badge}`}>
                        {moduloDisplay(e.modulo).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="text-xs text-slate-700 line-clamp-2">{e.entidadNombre}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${campoBadge}`}>
                        {CAMPO_LABEL[e.campo] ?? e.campo}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-xs text-slate-400 line-clamp-2">{formatValor(e.campo, e.valorAnterior)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-xs font-medium text-slate-800 line-clamp-2">{formatValor(e.campo, e.valorNuevo)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-slate-600">{e.realizadoPor}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer: conteo + cargar más */}
        {!isLoading && !error && entradas.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              Mostrando {entradas.length} registro{entradas.length !== 1 ? 's' : ''}
              {nextCursor ? ' — hay más disponibles' : ' — todos los registros cargados'}
            </span>
            {nextCursor && (
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Cargando...</>
                ) : (
                  <>Cargar más</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
