// CategoriasSection.tsx — gestión de categorías y asignación de equipos

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Equipo } from '../../../types/equipo.types';
import { equiposService } from '../../../services/equipos.service';
import EditarEquipoModal from '../EditarEquipoModal';
import { categoriasService } from '../../../services/categorias.service';
import type { TipoAdmin, CategoriaAdmin } from '../../../services/categorias.service';
import { extractApiError, sortEquiposByNumeracion } from '../../../utils/format';
import type { ToastType } from '../../../types/ui.types';
import { generarReporteCategorias } from '../../../utils/categorias.pdf';

interface CategoriasSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

// Sin TIPO_NOMBRES hardcodeado — se deriva del estado `tipos` cargado desde el API

type CatAction =
  | { type: 'idle' }
  | { type: 'editing'; nombre: string }
  | { type: 'deleting' }
  | { type: 'saving' };

const INPUT_CLS = 'w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60';

export default function CategoriasSection({ onShowToast }: CategoriasSectionProps) {
  const [tipos,     setTipos]     = useState<TipoAdmin[]>([]);
  const [equipos,   setEquipos]   = useState<Equipo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tipoActivo,   setTipoActivo]   = useState('');
  const [catActivaId,  setCatActivaId]  = useState<string | 'sin-categoria'>('sin-categoria');

  const [catActions,     setCatActions]     = useState<Record<string, CatAction>>({});
  const [addingNombre,   setAddingNombre]   = useState('');
  const [addingLoading,  setAddingLoading]  = useState(false);

  const [equipoLoading, setEquipoLoading] = useState<Record<string, boolean>>({});
  const [assignOpen,    setAssignOpen]    = useState<string | null>(null);
  const [quitarModal,   setQuitarModal]   = useState<Equipo | null>(null);
  const [editarEquipo,  setEditarEquipo]  = useState<Equipo | null>(null);
  const [generando,      setGenerando]      = useState(false);
  const [blockDeleteCat,   setBlockDeleteCat]   = useState<CategoriaAdmin | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CategoriaAdmin | null>(null);
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);

  const assignRef    = useRef<HTMLDivElement>(null);
  const allEquipos   = useRef<Equipo[]>([]);  // todos (activos + baja) — sólo para PDF

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const onShowToastRef = useRef(onShowToast);
  useEffect(() => { onShowToastRef.current = onShowToast; }, [onShowToast]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tiposData, equiposData] = await Promise.all([
        categoriasService.getTiposAdmin(),
        equiposService.getAll(),
      ]);
      allEquipos.current = equiposData;
      setTipos(tiposData);
      setEquipos(equiposData.filter(e => e.isActive));
      // Inicializar tab activo con el primer tipo disponible
      setTipoActivo(prev => prev || tiposData[0]?.nombre || '');
    } catch {
      onShowToastRef.current('error', 'Error', 'No se pudieron cargar los datos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cerrar dropdown de asignación al hacer clic fuera
  useEffect(() => {
    if (!assignOpen) return;
    const handler = (e: MouseEvent) => {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setAssignOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assignOpen]);

  // ── Computed ──────────────────────────────────────────────────────────────────
  const tipoActual = useMemo(
    () => tipos.find(t => t.nombre === tipoActivo),
    [tipos, tipoActivo],
  );

  const categoriasActivas = useMemo(
    () => tipoActual?.categorias ?? [],
    [tipoActual],
  );

  const equiposDelTipo = useMemo(
    () => equipos.filter(e => e.tipo.nombre === tipoActivo),
    [equipos, tipoActivo],
  );

  const equiposPorCategoria = useMemo(() => {
    const map = new Map<string, Equipo[]>();
    for (const cat of categoriasActivas) {
      map.set(cat.id, equipos.filter(e => e.categoriaId === cat.id));
    }
    return map;
  }, [equipos, categoriasActivas]);

  const equiposSinCategoria = useMemo(
    () => equiposDelTipo.filter(e => !e.categoriaId),
    [equiposDelTipo],
  );

  const catActivaEquipos = useMemo(() => {
    if (catActivaId === 'sin-categoria') return equiposSinCategoria;
    return equiposPorCategoria.get(catActivaId) ?? [];
  }, [catActivaId, equiposSinCategoria, equiposPorCategoria]);

  const catActivaNombre = useMemo(() => {
    if (catActivaId === 'sin-categoria') return 'Sin categoría';
    return categoriasActivas.find(c => c.id === catActivaId)?.nombre ?? '';
  }, [catActivaId, categoriasActivas]);

  // Si la categoría activa desaparece (fue eliminada), volver a "sin-categoria"
  useEffect(() => {
    if (catActivaId === 'sin-categoria') return;
    if (!categoriasActivas.find(c => c.id === catActivaId)) {
      setCatActivaId('sin-categoria');
    }
  }, [categoriasActivas, catActivaId]);

  // ── Cambio de tipo ────────────────────────────────────────────────────────────
  const handleTipoChange = (nombre: string) => {
    setTipoActivo(nombre);
    setCatActivaId('sin-categoria');
    setAddingNombre('');
    setAssignOpen(null);
    setQuitarModal(null);
  };

  // ── CRUD de categorías ────────────────────────────────────────────────────────
  const getAction  = (id: string): CatAction => catActions[id] ?? { type: 'idle' };
  const setAction  = (id: string, a: CatAction) =>
    setCatActions(prev => ({ ...prev, [id]: a }));

  const handleEditStart = (cat: CategoriaAdmin) =>
    setAction(cat.id, { type: 'editing', nombre: cat.nombre });

  const handleEditSave = async (cat: CategoriaAdmin) => {
    const action = getAction(cat.id);
    if (action.type !== 'editing') return;
    const nombre = action.nombre.trim();
    if (!nombre || nombre === cat.nombre) { setAction(cat.id, { type: 'idle' }); return; }

    setAction(cat.id, { type: 'saving' });
    try {
      const updated = await categoriasService.update(cat.id, nombre);
      setTipos(prev => prev.map(t =>
        t.nombre === tipoActivo
          ? { ...t, categorias: t.categorias.map(c => c.id === cat.id ? { ...c, nombre: updated.nombre } : c) }
          : t,
      ));
      onShowToast('success', 'Listo', `Categoría renombrada a "${updated.nombre}".`);
    } catch {
      onShowToast('error', 'Error', 'No se pudo renombrar la categoría.');
    } finally {
      setAction(cat.id, { type: 'idle' });
    }
  };

  const handleDeleteConfirm = async (cat: CategoriaAdmin) => {
    setAction(cat.id, { type: 'saving' });
    try {
      await categoriasService.delete(cat.id);
      setTipos(prev => prev.map(t =>
        t.nombre === tipoActivo
          ? { ...t, categorias: t.categorias.filter(c => c.id !== cat.id) }
          : t,
      ));
      onShowToast('success', 'Eliminada', `Categoría "${cat.nombre}" eliminada.`);
    } catch (err: unknown) {
      onShowToast('error', 'No se puede eliminar', extractApiError(err) ?? 'La categoría tiene equipos asignados.');
      setAction(cat.id, { type: 'idle' });
    }
  };

  const handleDeleteFromModal = async () => {
    if (!confirmDeleteCat) return;
    setIsDeletingConfirm(true);
    try {
      await categoriasService.delete(confirmDeleteCat.id);
      setTipos(prev => prev.map(t =>
        t.nombre === tipoActivo
          ? { ...t, categorias: t.categorias.filter(c => c.id !== confirmDeleteCat.id) }
          : t,
      ));
      onShowToast('success', 'Eliminada', `Categoría "${confirmDeleteCat.nombre}" eliminada.`);
      setConfirmDeleteCat(null);
    } catch (err: unknown) {
      onShowToast('error', 'Error', extractApiError(err) ?? 'No se pudo eliminar la categoría.');
    } finally {
      setIsDeletingConfirm(false);
    }
  };

  const handleAddCategoria = async () => {
    const nombre = addingNombre.trim();
    if (!nombre || !tipoActual) return;
    setAddingLoading(true);
    try {
      const nueva = await categoriasService.create(nombre, tipoActual.id);
      setTipos(prev => prev.map(t =>
        t.nombre === tipoActivo
          ? { ...t, categorias: [...t.categorias, { ...nueva, _count: { equipos: 0 } }] }
          : t,
      ));
      setAddingNombre('');
      onShowToast('success', 'Creada', `Categoría "${nueva.nombre}" creada.`);
    } catch (err: unknown) {
      onShowToast('error', 'Error', extractApiError(err) ?? 'No se pudo crear la categoría.');
    } finally {
      setAddingLoading(false);
    }
  };

  // ── Asignación de equipos ─────────────────────────────────────────────────────
  const handleAssign = async (equipo: Equipo, categoriaId: string | null) => {
    setEquipoLoading(prev => ({ ...prev, [equipo.id]: true }));
    setAssignOpen(null);
    setQuitarModal(null);
    const prevCategoriaId = equipo.categoriaId;
    try {
      const updated = await equiposService.update(equipo.id, { categoriaId });

      // Actualizar el equipo en el estado local
      setEquipos(prev => prev.map(e => e.id === equipo.id ? updated : e));

      // Sincronizar _count.equipos en el panel de categorías para que los
      // contadores del panel izquierdo reflejen el cambio sin recargar
      setTipos(prev => prev.map(t => ({
        ...t,
        categorias: t.categorias.map(c => {
          if (c.id === prevCategoriaId) return { ...c, _count: { equipos: Math.max(0, c._count.equipos - 1) } };
          if (c.id === categoriaId)     return { ...c, _count: { equipos: c._count.equipos + 1 } };
          return c;
        }),
      })));

      const catNombre = categoriaId
        ? (categoriasActivas.find(c => c.id === categoriaId)?.nombre ?? 'la categoría')
        : 'Sin categoría';
      onShowToast('success', 'Asignado', `#${equipo.numeracion} movido a "${catNombre}".`);
    } catch {
      onShowToast('error', 'Error', 'No se pudo actualizar la categoría del equipo.');
    } finally {
      setEquipoLoading(prev => ({ ...prev, [equipo.id]: false }));
    }
  };

  // ── Generar reporte PDF ───────────────────────────────────────────────────────
  const handleGenerarReporte = async () => {
    setGenerando(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      generarReporteCategorias(tipos, allEquipos.current);
    } finally {
      setGenerando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm gap-2">
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Cargando...
      </div>
    );
  }

  // ── Modal: categoría con equipos, no se puede eliminar ───────────────────────
  const blockEquipos = blockDeleteCat ? (equiposPorCategoria.get(blockDeleteCat.id) ?? []) : [];

  return (
    <div className="flex flex-col h-full gap-5">

      {/* Modal: confirmar eliminación (categoría sin equipos) */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">

            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Eliminar categoría</h2>
                <p className="text-xs text-slate-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                ¿Estás seguro de que deseas eliminar{' '}
                <span className="font-semibold text-slate-800">"{confirmDeleteCat.nombre}"</span>?
              </p>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={handleDeleteFromModal}
                disabled={isDeletingConfirm}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingConfirm ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button
                onClick={() => setConfirmDeleteCat(null)}
                disabled={isDeletingConfirm}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: bloqueo — categoría con equipos */}
      {blockDeleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-red-800">No se puede eliminar</h2>
                <p className="text-xs text-red-600 mt-0.5">
                  <span className="font-semibold">"{blockDeleteCat.nombre}"</span> tiene {blockEquipos.length} equipo{blockEquipos.length !== 1 ? 's' : ''} asignado{blockEquipos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Lista de equipos */}
            <div className="px-5 py-3">
              <p className="text-xs text-slate-500 mb-2">
                Quita o reasigna los siguientes equipos antes de eliminar la categoría:
              </p>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {sortEquiposByNumeracion(blockEquipos).map(e => (
                  <div key={e.id} className="flex items-center gap-2.5 px-3 py-2">
                    <span className="font-mono text-xs font-bold text-slate-400 w-10 flex-shrink-0 text-right">
                      #{e.numeracion}
                    </span>
                    <span className="text-xs text-slate-700 truncate">{e.descripcion}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setCatActivaId(blockDeleteCat.id);
                  setBlockDeleteCat(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Ver equipos
              </button>
              <button
                onClick={() => setBlockDeleteCat(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Categorías</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona categorías y la asignación de equipos</p>
        </div>
        <button
          onClick={handleGenerarReporte}
          disabled={generando || isLoading || tipos.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generando ? (
            <>
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Generando…
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
      </div>

      {/* Tipo tabs */}
      <div className="flex-shrink-0">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {tipos.map(t => (
            <button
              key={t.nombre}
              onClick={() => handleTipoChange(t.nombre)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tipoActivo === t.nombre
                  ? 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.nombre.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Columna izquierda: lista de categorías ── */}
        <div className="w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-sm overflow-hidden">

          <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categorías</p>
          </div>

          <div className="flex-1 overflow-y-auto">

            {categoriasActivas.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400 italic">Sin categorías — agrega una abajo</p>
            )}

            {categoriasActivas.map(cat => {
              const count    = (equiposPorCategoria.get(cat.id) ?? []).length;
              const isActive = catActivaId === cat.id;
              const action   = getAction(cat.id);

              if (action.type === 'editing' || action.type === 'saving') {
                return (
                  <div key={cat.id} className="px-3 py-2.5 border-b border-slate-100 bg-indigo-50/60">
                    <input
                      autoFocus
                      value={action.type === 'editing' ? action.nombre : cat.nombre}
                      disabled={action.type === 'saving'}
                      onChange={e => setAction(cat.id, { type: 'editing', nombre: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  handleEditSave(cat);
                        if (e.key === 'Escape') setAction(cat.id, { type: 'idle' });
                      }}
                      className={INPUT_CLS}
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        onClick={() => handleEditSave(cat)}
                        disabled={action.type === 'saving'}
                        className="flex-1 text-xs py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {action.type === 'saving' ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setAction(cat.id, { type: 'idle' })}
                        disabled={action.type === 'saving'}
                        className="flex-1 text-xs py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              // Normal row
              return (
                <div
                  key={cat.id}
                  onClick={() => setCatActivaId(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-b border-slate-50 group cursor-pointer ${
                    isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm font-medium truncate flex-1 leading-tight ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {cat.nombre}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                      isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                    {/* Edit / delete — visible on hover */}
                    <div className="hidden group-hover:flex gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); handleEditStart(cat); }}
                        title="Renombrar"
                        className="p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (count > 0) setBlockDeleteCat(cat);
                          else setConfirmDeleteCat(cat);
                        }}
                        title="Eliminar"
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Sin categoría — siempre al final */}
            <button
              onClick={() => setCatActivaId('sin-categoria')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                catActivaId === 'sin-categoria' ? 'bg-amber-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-sm font-medium italic ${catActivaId === 'sin-categoria' ? 'text-amber-700' : 'text-slate-400'}`}>
                Sin categoría
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                equiposSinCategoria.length > 0
                  ? catActivaId === 'sin-categoria'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-amber-100 text-amber-600'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {equiposSinCategoria.length}
              </span>
            </button>
          </div>

          {/* Input nueva categoría */}
          <div className="border-t border-slate-200 p-3 flex-shrink-0">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={addingNombre}
                onChange={e => setAddingNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategoria(); }}
                placeholder="Nueva categoría..."
                disabled={addingLoading}
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 placeholder-slate-400"
              />
              <button
                onClick={handleAddCategoria}
                disabled={addingLoading || !addingNombre.trim()}
                title="Agregar categoría"
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {addingLoading ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Columna derecha: equipos de la categoría seleccionada ── */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-sm overflow-hidden min-w-0">

          {/* Header derecho */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">{catActivaNombre}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {catActivaEquipos.length} equipo{catActivaEquipos.length !== 1 ? 's' : ''}
                {catActivaId === 'sin-categoria' && categoriasActivas.length > 0 && catActivaEquipos.length > 0 &&
                  ' · Usa "Asignar" para mover equipos a una categoría'
                }
              </p>
            </div>
          </div>

          {/* Lista de equipos */}
          <div className="flex-1 overflow-y-auto" ref={assignRef}>
            {catActivaEquipos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-16">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <p className="text-sm font-medium">
                  {catActivaId === 'sin-categoria'
                    ? 'Todos los equipos de este tipo tienen categoría'
                    : 'No hay equipos asignados a esta categoría'}
                </p>
                {catActivaId !== 'sin-categoria' && equiposSinCategoria.length > 0 && (
                  <button
                    onClick={() => setCatActivaId('sin-categoria')}
                    className="mt-1 text-xs text-indigo-600 hover:underline"
                  >
                    Ver {equiposSinCategoria.length} sin categoría →
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {sortEquiposByNumeracion(catActivaEquipos).map(equipo => {
                  const loading = equipoLoading[equipo.id];
                  return (
                    <div
                      key={equipo.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-mono text-xs font-bold text-slate-400 w-10 flex-shrink-0 text-right">
                        #{equipo.numeracion}
                      </span>
                      <span className="text-sm text-slate-700 flex-1 truncate">
                        {equipo.descripcion}
                      </span>

                      {loading ? (
                        <svg className="animate-spin text-indigo-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                      ) : catActivaId === 'sin-categoria' ? (
                        /* Acciones para equipo sin categoría */
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setEditarEquipo(equipo)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            Editar
                          </button>
                          <div className="relative" ref={assignOpen === equipo.id ? assignRef : undefined}>
                            <button
                              onClick={() => setAssignOpen(prev => prev === equipo.id ? null : equipo.id)}
                              disabled={categoriasActivas.length === 0}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Asignar
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                            {assignOpen === equipo.id && (
                              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                                {categoriasActivas.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => handleAssign(equipo, cat.id)}
                                    className="w-full text-left text-sm px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors"
                                  >
                                    {cat.nombre}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Acciones para equipo con categoría */
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setEditarEquipo(equipo)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setQuitarModal(equipo)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-colors"
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal: editar equipo (reasignar tipo / categoría) */}
      <EditarEquipoModal
        equipo={editarEquipo}
        open={editarEquipo !== null}
        tipos={tipos}
        onClose={() => setEditarEquipo(null)}
        onSave={updated => {
          setEquipos(prev => prev.map(e => e.id === updated.id ? updated : e));
          setTipos(prev => prev.map(t => ({
            ...t,
            categorias: t.categorias.map(c => {
              if (c.id === editarEquipo?.categoriaId) return { ...c, _count: { equipos: Math.max(0, c._count.equipos - 1) } };
              if (c.id === updated.categoriaId)       return { ...c, _count: { equipos: c._count.equipos + 1 } };
              return c;
            }),
          })));
          setEditarEquipo(null);
          onShowToast('success', 'Equipo actualizado', `#${updated.numeracion} guardado correctamente.`);
        }}
      />

      {/* Modal: confirmar quitar categoría */}
      {quitarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">

            {/* Icono + título */}
            <div className="flex flex-col items-center pt-7 pb-4 px-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 className="text-sm font-bold text-slate-800 mb-1">¿Quitar de la categoría?</h2>
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                El equipo saldrá de{' '}
                <span className="font-semibold text-slate-700">"{quitarModal.categoria?.nombre ?? catActivaNombre}"</span>{' '}
                y quedará en <span className="font-semibold text-slate-700">Sin categoría</span> hasta que sea reasignado.
              </p>
            </div>

            {/* Info del equipo */}
            <div className="mx-5 mb-5 flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-600 font-mono">#{quitarModal.numeracion}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{quitarModal.descripcion}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-400">{quitarModal.tipo.nombre.replace(/_/g, ' ')}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-amber-600 font-medium">{quitarModal.categoria?.nombre ?? catActivaNombre}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 flex-shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span className="text-xs text-slate-400 italic">Sin categoría</span>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => { const e = quitarModal; setQuitarModal(null); handleAssign(e, null); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Quitar
              </button>
              <button
                onClick={() => setQuitarModal(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
