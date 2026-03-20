// CategoriasSection.tsx — gestión de categorías y asignación de equipos

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Equipo } from '../../../types/equipo.types';
import { TIPO_LABEL } from '../../../types/equipo.types';
import { equiposService } from '../../../services/equipos.service';
import { categoriasService } from '../../../services/categorias.service';
import type { TipoAdmin, CategoriaAdmin } from '../../../services/categorias.service';
import type { ToastType } from '../../../pages/admin/AdminDashboard';

interface CategoriasSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

const TIPO_NOMBRES = ['LIVIANA', 'PESADA', 'USO_PROPIO'];

type CatAction =
  | { type: 'idle' }
  | { type: 'editing'; nombre: string }
  | { type: 'deleting' }
  | { type: 'saving' };

function sortEquipos(list: Equipo[]): Equipo[] {
  return [...list].sort((a, b) => {
    const aNum = /^\d+$/.test(a.numeracion);
    const bNum = /^\d+$/.test(b.numeracion);
    if (aNum && bNum) return parseInt(a.numeracion) - parseInt(b.numeracion);
    if (aNum) return -1;
    if (bNum) return 1;
    return a.numeracion.localeCompare(b.numeracion);
  });
}

export default function CategoriasSection({ onShowToast }: CategoriasSectionProps) {
  const [tipos,     setTipos]     = useState<TipoAdmin[]>([]);
  const [equipos,   setEquipos]   = useState<Equipo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tipoActivo,   setTipoActivo]   = useState('LIVIANA');
  const [catActivaId,  setCatActivaId]  = useState<string | 'sin-categoria'>('sin-categoria');

  const [catActions,     setCatActions]     = useState<Record<string, CatAction>>({});
  const [addingNombre,   setAddingNombre]   = useState('');
  const [addingLoading,  setAddingLoading]  = useState(false);

  const [equipoLoading, setEquipoLoading] = useState<Record<string, boolean>>({});
  const [assignOpen,     setAssignOpen]     = useState<string | null>(null);
  const [quitarConfirm,  setQuitarConfirm]  = useState<string | null>(null);
  const assignRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tiposData, equiposData] = await Promise.all([
        categoriasService.getTiposAdmin(),
        equiposService.getAll(),
      ]);
      setTipos(tiposData);
      setEquipos(equiposData.filter(e => e.isActive));
    } catch {
      onShowToast('error', 'Error', 'No se pudieron cargar los datos.');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

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
    setQuitarConfirm(null);
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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      onShowToast('error', 'No se puede eliminar', msg ?? 'La categoría tiene equipos asignados.');
      setAction(cat.id, { type: 'idle' });
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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      onShowToast('error', 'Error', msg ?? 'No se pudo crear la categoría.');
    } finally {
      setAddingLoading(false);
    }
  };

  // ── Asignación de equipos ─────────────────────────────────────────────────────
  const handleAssign = async (equipo: Equipo, categoriaId: string | null) => {
    setEquipoLoading(prev => ({ ...prev, [equipo.id]: true }));
    setAssignOpen(null);
    try {
      const updated = await equiposService.update(equipo.id, { categoriaId });
      setEquipos(prev => prev.map(e => e.id === equipo.id ? updated : e));
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

  // ── Render helpers ────────────────────────────────────────────────────────────
  const inputCls = 'w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60';

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

  return (
    <div className="flex flex-col h-full gap-5">

      {/* Header */}
      <div className="flex items-end justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Categorías</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona categorías y la asignación de equipos</p>
        </div>
      </div>

      {/* Tipo tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-shrink-0">
        {TIPO_NOMBRES.map(nombre => (
          <button
            key={nombre}
            onClick={() => handleTipoChange(nombre)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tipoActivo === nombre
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {TIPO_LABEL[nombre] ?? nombre}
          </button>
        ))}
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
                      className={inputCls}
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

              if (action.type === 'deleting') {
                return (
                  <div key={cat.id} className="px-3 py-2.5 border-b border-slate-100 bg-red-50">
                    <p className="text-xs text-red-700 font-semibold mb-1 truncate">¿Eliminar "{cat.nombre}"?</p>
                    {count > 0 && (
                      <p className="text-[11px] text-red-500 mb-1.5">
                        Tiene {count} equipo{count !== 1 ? 's' : ''} asignado{count !== 1 ? 's' : ''}.
                      </p>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleDeleteConfirm(cat)}
                        className="flex-1 text-xs py-1 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                      >
                        Eliminar
                      </button>
                      <button
                        onClick={() => setAction(cat.id, { type: 'idle' })}
                        className="flex-1 text-xs py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              // Normal row
              return (
                <button
                  key={cat.id}
                  onClick={() => setCatActivaId(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-b border-slate-50 group ${
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
                        onClick={e => { e.stopPropagation(); setAction(cat.id, { type: 'deleting' }); }}
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
                </button>
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
                {sortEquipos(catActivaEquipos).map(equipo => {
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
                        /* Dropdown para asignar categoría */
                        <div className="relative flex-shrink-0">
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
                      ) : quitarConfirm === equipo.id ? (
                        /* Confirmación inline */
                        <div className="flex items-center gap-2 flex-shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
                            Pasará a "Sin categoría"
                          </span>
                          <button
                            onClick={() => { setQuitarConfirm(null); handleAssign(equipo, null); }}
                            className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setQuitarConfirm(null)}
                            className="px-2 py-0.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        /* Botón para quitar de la categoría */
                        <button
                          onClick={() => setQuitarConfirm(equipo.id)}
                          className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-colors"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
