// BitacorasSection.tsx — registro de cambios en equipos y usuarios del sistema

import { useState, useEffect } from 'react';
import { equiposService } from '../../../services/equipos.service';
import type { BitacoraEntry } from '../../../services/equipos.service';
import type { TipoMaquinaria } from '../../../types/equipo.types';
import { TIPO_LABEL } from '../../../types/equipo.types';

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
  // usuarios
  nombre:          'Nombre',
  username:        'Usuario',
  telefono:        'Teléfono',
  reset_password:  'Reseteo de contraseña',
  desactivar:      'Desactivación',
  activar:         'Activación',
};

const CAMPOS_MONEDA = new Set(['montoCompra', 'rentaDia', 'rentaSemana', 'rentaMes']);

const CAMPO_BADGE: Record<string, string> = {
  reset_password: 'bg-amber-50 text-amber-700',
  desactivar:     'bg-red-50 text-red-700',
  activar:        'bg-green-50 text-green-700',
};

function formatValor(campo: string, valor: string | null): string {
  if (valor === null) return '—';
  if (CAMPOS_MONEDA.has(campo)) {
    const n = parseFloat(valor);
    return isNaN(n) ? valor : `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (campo === 'tipo') return TIPO_LABEL[valor as TipoMaquinaria] ?? valor;
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

type ModuloFiltro = '' | 'equipo' | 'usuario';

export default function BitacorasSection() {
  const [entradas, setEntradas]     = useState<BitacoraEntry[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [filtroModulo, setFiltroModulo] = useState<ModuloFiltro>('');

  useEffect(() => {
    equiposService.getBitacoras()
      .then(data => setEntradas(data))
      .catch(() => setError('No se pudo cargar el registro de cambios.'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtradas = entradas.filter(e => {
    if (filtroModulo && e.modulo !== filtroModulo) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.entidadNombre.toLowerCase().includes(q)              ||
      (CAMPO_LABEL[e.campo] ?? e.campo).toLowerCase().includes(q) ||
      e.realizadoPor.toLowerCase().includes(q)               ||
      (e.valorAnterior ?? '').toLowerCase().includes(q)      ||
      (e.valorNuevo    ?? '').toLowerCase().includes(q)
    );
  });

  const hoy = new Date().toLocaleDateString('es-GT');
  const cambiosHoy       = entradas.filter(e => new Date(e.createdAt).toLocaleDateString('es-GT') === hoy).length;
  const cambiosEquipos   = entradas.filter(e => e.modulo === 'equipo').length;
  const cambiosUsuarios  = entradas.filter(e => e.modulo === 'usuario').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Bitácoras</h1>
        <p className="text-sm text-slate-500 mt-1">Registro de cambios realizados en equipos y usuarios del sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total de registros', value: entradas.length,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'Cambios hoy',        value: cambiosHoy,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'En equipos',         value: cambiosEquipos,    color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'En usuarios',        value: cambiosUsuarios,   color: 'text-violet-600',  bg: 'bg-violet-50' },
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
          {([
            { id: '' as ModuloFiltro,        label: 'Todos',    count: entradas.length },
            { id: 'equipo' as ModuloFiltro,  label: 'Equipos',  count: cambiosEquipos },
            { id: 'usuario' as ModuloFiltro, label: 'Usuarios', count: cambiosUsuarios },
          ]).map(t => (
            <button key={t.id} onClick={() => setFiltroModulo(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-r border-slate-200 last:border-0 transition-colors ${
                filtroModulo === t.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {t.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                filtroModulo === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
              }`}>{t.count}</span>
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, campo, usuario..."
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[260px]"
          />
        </div>

        {(search || filtroModulo) && (
          <button onClick={() => { setSearch(''); setFiltroModulo(''); }}
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
              {!isLoading && !error && filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    {search || filtroModulo ? 'No se encontraron resultados.' : 'No hay cambios registrados aún.'}
                  </td>
                </tr>
              )}
              {!isLoading && !error && filtradas.map(e => {
                const { fecha, hora } = formatFechaHora(e.createdAt);
                const campoBadge = CAMPO_BADGE[e.campo] ?? 'bg-indigo-50 text-indigo-700';
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">

                    {/* Fecha y hora */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-700">{fecha}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{hora}</div>
                    </td>

                    {/* Módulo */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        e.modulo === 'equipo' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                      }`}>
                        {e.modulo === 'equipo' ? 'Equipo' : 'Usuario'}
                      </span>
                    </td>

                    {/* Entidad */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="text-xs text-slate-700 line-clamp-2">{e.entidadNombre}</span>
                    </td>

                    {/* Campo */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${campoBadge}`}>
                        {CAMPO_LABEL[e.campo] ?? e.campo}
                      </span>
                    </td>

                    {/* Valor anterior */}
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-xs text-slate-400 line-clamp-2">
                        {formatValor(e.campo, e.valorAnterior)}
                      </span>
                    </td>

                    {/* Valor nuevo */}
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-xs font-medium text-slate-800 line-clamp-2">
                        {formatValor(e.campo, e.valorNuevo)}
                      </span>
                    </td>

                    {/* Realizado por */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-slate-600">{e.realizadoPor}</span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && filtradas.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">
              {filtradas.length} {filtradas.length === 1 ? 'registro' : 'registros'}
              {(search || filtroModulo) && ` de ${entradas.length} en total`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
