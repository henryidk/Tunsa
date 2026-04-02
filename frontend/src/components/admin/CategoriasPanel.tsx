// CategoriasPanel.tsx — slide-over para administrar categorías por tipo

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { categoriasService } from '../../services/categorias.service';
import type { TipoAdmin, CategoriaAdmin } from '../../services/categorias.service';
import { TIPO_BADGE } from '../../types/equipo.types';

interface CategoriasPanelProps {
  open:                boolean;
  onClose:             () => void;
  onCategoriasChanged: () => void;   // notifica al padre para refrescar los formularios
}

type ActionState =
  | { type: 'idle' }
  | { type: 'editing';  id: string; value: string }
  | { type: 'deleting'; id: string }
  | { type: 'saving' };

export default function CategoriasPanel({ open, onClose, onCategoriasChanged }: CategoriasPanelProps) {
  const [tipos,     setTipos]     = useState<TipoAdmin[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tabIdx,    setTabIdx]    = useState(0);
  const [action,    setAction]    = useState<ActionState>({ type: 'idle' });
  const [newNombre, setNewNombre] = useState('');
  const [addingErr, setAddingErr] = useState<string | null>(null);
  const [apiErr,    setApiErr]    = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef  = useRef<HTMLInputElement>(null);

  // ── Cargar datos cuando se abre ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setAction({ type: 'idle' });
    setNewNombre('');
    setAddingErr(null);
    setApiErr(null);
    categoriasService.getTiposAdmin()
      .then(data => { setTipos(data); setTabIdx(0); })
      .catch(() => setApiErr('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, [open]);

  // Focus al input de edición cuando aparece
  useEffect(() => {
    if (action.type === 'editing') editInputRef.current?.focus();
  }, [action]);

  if (!open) return null;

  const tipoActivo = tipos[tabIdx];

  // ── Helpers de error ──────────────────────────────────────────────────────────
  function extractMsg(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      return msg ?? 'Ocurrió un error.';
    }
    return 'Ocurrió un error.';
  }

  // ── Agregar ───────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const nombre = newNombre.trim();
    if (!nombre) { setAddingErr('Escribe un nombre.'); return; }
    if (!tipoActivo) return;
    setAction({ type: 'saving' });
    setAddingErr(null);
    try {
      const nueva = await categoriasService.create(nombre, tipoActivo.id);
      setTipos(prev => prev.map((t, i) =>
        i !== tabIdx ? t : { ...t, categorias: [...t.categorias, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)) }
      ));
      setNewNombre('');
      onCategoriasChanged();
      addInputRef.current?.focus();
    } catch (err) {
      setAddingErr(extractMsg(err));
    } finally {
      setAction({ type: 'idle' });
    }
  };

  // ── Guardar edición ──────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (action.type !== 'editing') return;
    const nombre = action.value.trim();
    if (!nombre) return;
    const id = action.id;
    setAction({ type: 'saving' });
    try {
      const actualizada = await categoriasService.update(id, nombre);
      setTipos(prev => prev.map((t, i) =>
        i !== tabIdx ? t : {
          ...t,
          categorias: t.categorias
            .map(c => c.id === id ? actualizada : c)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        }
      ));
      onCategoriasChanged();
    } catch (err) {
      setApiErr(extractMsg(err));
    } finally {
      setAction({ type: 'idle' });
    }
  };

  // ── Eliminar ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setAction({ type: 'saving' });
    try {
      await categoriasService.delete(id);
      setTipos(prev => prev.map((t, i) =>
        i !== tabIdx ? t : { ...t, categorias: t.categorias.filter(c => c.id !== id) }
      ));
      onCategoriasChanged();
    } catch (err) {
      setApiErr(extractMsg(err));
    } finally {
      setAction({ type: 'idle' });
    }
  };

  const isBusy = action.type === 'saving';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1900] bg-black/30"
        onClick={() => { if (!isBusy) onClose(); }}
      />

      {/* Panel */}
      <div className="fixed right-0 inset-y-0 z-[2000] w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Categorías</h2>
            <p className="text-xs text-slate-400 mt-0.5">Administra las categorías del inventario</p>
          </div>
          <button onClick={onClose} disabled={isBusy}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs por tipo */}
        {!loading && tipos.length > 0 && (
          <div className="flex border-b border-slate-200 flex-shrink-0 overflow-x-auto">
            {tipos.map((t, i) => (
              <button
                key={t.id}
                onClick={() => { setTabIdx(i); setAction({ type: 'idle' }); setApiErr(null); setNewNombre(''); setAddingErr(null); }}
                disabled={isBusy}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors disabled:opacity-50 ${
                  tabIdx === i
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${TIPO_BADGE[t.nombre]?.split(' ')[0] ?? 'bg-slate-300'}`} />
                {t.nombre.replace(/_/g, ' ')}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tabIdx === i ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {t.categorias.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Cargando...
            </div>
          )}

          {!loading && tipoActivo && (
            <ul className="divide-y divide-slate-100">
              {tipoActivo.categorias.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">
                  Sin categorías. Agrega la primera abajo.
                </li>
              )}

              {tipoActivo.categorias.map(cat => {
                const isEditing  = action.type === 'editing'  && action.id === cat.id;
                const isDeleting = action.type === 'deleting' && action.id === cat.id;
                const count      = cat._count.equipos;

                return (
                  <li key={cat.id} className="flex items-center gap-2 px-5 py-2.5 hover:bg-slate-50 transition-colors group">

                    {/* Modo edición */}
                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          value={action.value}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setAction({ type: 'editing', id: cat.id, value: e.target.value })
                          }
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setAction({ type: 'idle' });
                          }}
                          disabled={isBusy}
                          className="flex-1 border border-indigo-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <button onClick={handleSaveEdit} disabled={isBusy || !action.value.trim()}
                          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                        <button onClick={() => setAction({ type: 'idle' })} disabled={isBusy}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-40">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </>
                    ) : isDeleting ? (
                      /* Modo confirmación de borrado */
                      <>
                        <span className="flex-1 text-sm text-slate-700 truncate">{cat.nombre}</span>
                        <span className="text-xs text-red-500 font-medium">¿Eliminar?</span>
                        <button onClick={() => handleDelete(cat.id)} disabled={isBusy}
                          className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-40">
                          {isBusy ? '...' : 'Sí'}
                        </button>
                        <button onClick={() => setAction({ type: 'idle' })} disabled={isBusy}
                          className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors disabled:opacity-40">
                          No
                        </button>
                      </>
                    ) : (
                      /* Modo normal */
                      <>
                        <span className="flex-1 text-sm text-slate-700 truncate">{cat.nombre}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          count > 0 ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {count} {count === 1 ? 'equipo' : 'equipos'}
                        </span>
                        {/* Editar */}
                        <button
                          onClick={() => { setApiErr(null); setAction({ type: 'editing', id: cat.id, value: cat.nombre }); }}
                          disabled={isBusy}
                          title="Renombrar"
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all disabled:opacity-30">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {/* Eliminar */}
                        <button
                          onClick={() => { setApiErr(null); setAction({ type: 'deleting', id: cat.id }); }}
                          disabled={isBusy || count > 0}
                          title={count > 0 ? `No se puede eliminar: ${count} equipo(s) la usan` : 'Eliminar'}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer — agregar nueva categoría */}
        {!loading && tipoActivo && (
          <div className="border-t border-slate-200 px-5 py-4 flex-shrink-0 space-y-2">
            {apiErr && (
              <p className="text-xs text-red-500 font-medium">{apiErr}</p>
            )}
            <div className="flex gap-2">
              <input
                ref={addInputRef}
                type="text"
                value={newNombre}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setNewNombre(e.target.value); setAddingErr(null); }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleAdd(); }}
                disabled={isBusy}
                placeholder={`Nueva categoría para ${tipoActivo.nombre.replace(/_/g, ' ')}...`}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
              />
              <button
                onClick={handleAdd}
                disabled={isBusy || !newNombre.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                {isBusy
                  ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                }
                Agregar
              </button>
            </div>
            {addingErr && <p className="text-xs text-red-500">{addingErr}</p>}
          </div>
        )}
      </div>
    </>
  );
}
