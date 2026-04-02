// EquiposSection.tsx — inventario completo de equipos

import { useState, useMemo } from 'react';
import type { Equipo } from '../../../types/equipo.types';
import { TIPO_BADGE } from '../../../types/equipo.types';
import { useEquipos } from '../../../hooks/useEquipos';
import { useCategorias } from '../../../hooks/useCategorias';
import { equiposService } from '../../../services/equipos.service';
import { generarReporteInventario } from '../../../utils/equipos.pdf';
import AgregarEquipoModal from '../AgregarEquipoModal';
import EditarEquipoModal from '../EditarEquipoModal';
import PreciosEquipoModal from '../PreciosEquipoModal';
import BajaEquipoModal from '../BajaEquipoModal';
import type { ToastType } from '../../../pages/admin/AdminDashboard'

interface EquiposSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

type TabId = 'activos' | 'baja';

function formatMoneda(value: number | null | undefined): string {
  if (value == null) return '—';
  return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EquiposSection({ onShowToast }: EquiposSectionProps) {
  const { equipos, isLoading, error, addEquipo, updateEquipo } = useEquipos();
  const { tipos } = useCategorias();

  const [tab, setTab]                     = useState<TabId>('activos');
  const [search, setSearch]               = useState('');
  const [filtroTipo, setFiltroTipo]       = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [agregarOpen, setAgregarOpen]     = useState(false);
  const [editEquipo, setEditEquipo]       = useState<Equipo | null>(null);
  const [preciosEquipo, setPreciosEquipo] = useState<Equipo | null>(null);
  const [bajaEquipo, setBajaEquipo]       = useState<Equipo | null>(null);
  const [reactivandoId, setReactivandoId] = useState<string | null>(null);
  const [generando, setGenerando]         = useState(false);

  // ── Categorías disponibles según tipo seleccionado ────────────────────────
  const categoriasDisponibles = useMemo(() => {
    const base = filtroTipo
      ? equipos.filter(e => e.tipo.nombre === filtroTipo)
      : equipos;
    const nombres = base
      .map(e => e.categoria?.nombre)
      .filter((n): n is string => !!n);
    return [...new Set(nombres)].sort();
  }, [equipos, filtroTipo]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const base = equipos.filter(e => tab === 'activos' ? e.isActive : !e.isActive);

  const filtered = base.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.numeracion.toLowerCase().includes(q)             ||
      e.descripcion.toLowerCase().includes(q)            ||
      (e.categoria?.nombre ?? '').toLowerCase().includes(q) ||
      (e.serie ?? '').toLowerCase().includes(q);

    const matchTipo      = !filtroTipo      || e.tipo.nombre            === filtroTipo;
    const matchCategoria = !filtroCategoria || e.categoria?.nombre       === filtroCategoria;

    return matchSearch && matchTipo && matchCategoria;
  }).sort((a, b) => {
    const aIsNum = /^\d+$/.test(a.numeracion);
    const bIsNum = /^\d+$/.test(b.numeracion);
    if (aIsNum && bIsNum) return parseInt(a.numeracion) - parseInt(b.numeracion);
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.numeracion.localeCompare(b.numeracion);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activos   = equipos.filter(e => e.isActive);
  const dadosBaja = equipos.filter(e => !e.isActive);
  const valorTotal = activos.reduce((sum, e) => sum + e.montoCompra, 0);

  // ── Generar reporte PDF ────────────────────────────────────────────────────
  const handleGenerarReporte = async () => {
    setGenerando(true);
    try {
      // pequeño timeout para que el spinner sea visible antes del trabajo síncrono
      await new Promise(r => setTimeout(r, 50));
      generarReporteInventario(equipos);
    } finally {
      setGenerando(false);
    }
  };

  // ── Reactivar ──────────────────────────────────────────────────────────────
  const handleReactivar = async (e: Equipo) => {
    setReactivandoId(e.id);
    try {
      const updated = await equiposService.reactivar(e.id);
      updateEquipo(updated);
      onShowToast('success', 'Equipo reactivado', `#${e.numeracion} está activo nuevamente`);
    } catch {
      onShowToast('error', 'Error', 'No se pudo reactivar el equipo');
    } finally {
      setReactivandoId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario de equipos</h1>
          <p className="text-sm text-slate-500 mt-1">Registro y control del inventario de maquinaria</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleGenerarReporte}
            disabled={generando || isLoading || equipos.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generando ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                Generar reporte
              </>
            )}
          </button>
          <button
            onClick={() => setAgregarOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar equipo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Equipos activos',  value: activos.length,       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          // Tarjetas por tipo — dinámicas, soportan tipos nuevos automáticamente
          ...[...new Set(activos.map(e => e.tipo.nombre))].map(nombre => ({
            label: nombre.replace(/_/g, ' '),
            value: activos.filter(e => e.tipo.nombre === nombre).length,
            color: nombre === 'LIVIANA' ? 'text-blue-600' : nombre === 'PESADA' ? 'text-amber-600' : 'text-slate-600',
            bg:    nombre === 'LIVIANA' ? 'bg-blue-50'   : nombre === 'PESADA' ? 'bg-amber-50'  : 'bg-slate-50',
          })),
          { label: 'Valor inventario', value: formatMoneda(valorTotal), color: 'text-emerald-600', bg: 'bg-emerald-50', isString: true },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${s.bg} mb-2`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={s.color}>
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {([
            { id: 'activos', label: 'Activos',       count: activos.length,   cls: 'bg-indigo-100 text-indigo-700' },
            { id: 'baja',    label: 'Dados de baja', count: dadosBaja.length, cls: 'bg-red-100 text-red-600' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-r border-slate-200 last:border-0 transition-colors ${
                tab === t.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {t.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? t.cls : 'bg-slate-100 text-slate-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por no., descripción o serie..."
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[240px]" />
        </div>

        {/* Filtro tipo */}
        <select value={filtroTipo} onChange={e => {
          const nuevoTipo = e.target.value;
          setFiltroTipo(nuevoTipo);
          // resetear categoría si ya no pertenece al nuevo tipo
          if (filtroCategoria) {
            const cats = nuevoTipo
              ? equipos.filter(eq => eq.tipo.nombre === nuevoTipo).map(eq => eq.categoria?.nombre)
              : equipos.map(eq => eq.categoria?.nombre);
            if (!cats.includes(filtroCategoria)) setFiltroCategoria('');
          }
        }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option value="">Todos los tipos</option>
          {[...new Set(equipos.map(e => e.tipo.nombre))].map(nombre => (
            <option key={nombre} value={nombre}>
              {nombre.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Filtro categoría */}
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Reset filtros */}
        {(search || filtroTipo || filtroCategoria) && (
          <button onClick={() => { setSearch(''); setFiltroTipo(''); setFiltroCategoria(''); }}
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
                {['No.', 'Equipo', 'Series', 'Tipo', 'Monto compra', 'Renta / día', 'Fecha compra', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Loading */}
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Cargando inventario...</td></tr>
              )}
              {/* Error */}
              {error && !isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
              )}
              {/* Empty */}
              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="text-slate-400 text-sm">
                      {search || filtroTipo || filtroCategoria
                        ? 'No se encontraron equipos con esos filtros.'
                        : tab === 'baja' ? 'No hay equipos dados de baja.' : 'No hay equipos registrados.'}
                    </div>
                  </td>
                </tr>
              )}
              {/* Rows */}
              {!isLoading && !error && filtered.map(e => (
                <tr key={e.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!e.isActive ? 'opacity-60' : ''}`}>

                  {/* No. */}
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">
                      #{e.numeracion}
                    </span>
                  </td>

                  {/* Equipo */}
                  <td className="px-4 py-3 max-w-[240px]">
                    <div className="font-medium text-slate-800 leading-snug line-clamp-2 text-xs">{e.descripcion}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {e.categoria && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {e.categoria.nombre}
                        </span>
                      )}
                      {e.cantidad > 1 && (
                        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                          ×{e.cantidad.toLocaleString('es-GT')} uds.
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Serie */}
                  <td className="px-4 py-3 max-w-[180px]">
                    {e.serie
                      ? <div className="text-[11px] font-mono text-slate-600 truncate" title={e.serie}>{e.serie}</div>
                      : <span className="text-xs text-slate-300">—</span>
                    }
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${TIPO_BADGE[e.tipo.nombre] ?? 'bg-slate-100 text-slate-600'}`}>
                      {e.tipo.nombre.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Monto compra */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {formatMoneda(e.montoCompra)}
                  </td>

                  {/* Renta / día */}
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 whitespace-nowrap">
                    {e.rentaDia != null ? `Q${e.rentaDia.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Fecha compra */}
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatFecha(e.fechaCompra)}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {e.isActive ? (
                        <>
                          <button onClick={() => setPreciosEquipo(e)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors">
                            Precios
                          </button>
                          <button onClick={() => setEditEquipo(e)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                            Editar
                          </button>
                          <button onClick={() => setBajaEquipo(e)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">
                            Dar de baja
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] text-slate-400 max-w-[120px] truncate" title={e.motivoBaja ?? ''}>
                            {e.motivoBaja ?? 'Sin motivo'}
                          </div>
                          <button
                            disabled={reactivandoId === e.id}
                            onClick={() => handleReactivar(e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {reactivandoId === e.id ? (
                              <><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>...</>
                            ) : 'Reactivar'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer de la tabla */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {filtered.length} {filtered.length === 1 ? 'equipo' : 'equipos'} encontrados
              {(search || filtroTipo || filtroCategoria) && ` de ${base.length} en total`}
            </span>
            {tab === 'activos' && (
              <span className="text-xs text-slate-400 font-mono">
                Valor filtrado: {formatMoneda(filtered.reduce((s, e) => s + e.montoCompra, 0))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      <AgregarEquipoModal
        open={agregarOpen}
        tipos={tipos}
        onClose={() => setAgregarOpen(false)}
        onCreated={nuevo => {
          addEquipo(nuevo);
          onShowToast('success', 'Equipo registrado', `#${nuevo.numeracion} agregado al inventario`);
        }}
      />

      <EditarEquipoModal
        equipo={editEquipo}
        open={editEquipo !== null}
        tipos={tipos}
        onClose={() => setEditEquipo(null)}
        onSave={updated => {
          updateEquipo(updated);
          setEditEquipo(null);
          onShowToast('success', 'Equipo actualizado', `#${updated.numeracion} guardado correctamente`);
        }}
      />

      <PreciosEquipoModal
        equipo={preciosEquipo}
        open={preciosEquipo !== null}
        onClose={() => setPreciosEquipo(null)}
        onSave={updated => {
          updateEquipo(updated);
          setPreciosEquipo(null);
          onShowToast('success', 'Precios actualizados', `#${updated.numeracion} actualizado correctamente`);
        }}
      />

      <BajaEquipoModal
        equipo={bajaEquipo}
        open={bajaEquipo !== null}
        onClose={() => setBajaEquipo(null)}
        onConfirm={updated => {
          updateEquipo(updated);
          setBajaEquipo(null);
          onShowToast('warning', 'Equipo dado de baja', `#${updated.numeracion} marcado como inactivo`);
        }}
      />

    </div>
  );
}
