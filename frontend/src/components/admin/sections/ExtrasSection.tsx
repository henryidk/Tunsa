import { useState, useEffect, useCallback } from 'react';
import { extrasService, type TipoExtra } from '../../../services/equipos.service';
import TipoExtraModal from '../TipoExtraModal';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

type ModalState =
  | { open: false }
  | { open: true; modo: 'crear' }
  | { open: true; modo: 'editar'; tipoExtra: TipoExtra };

type EliminarState =
  | { id: null }
  | { id: string; nombre: string; confirmando: boolean; eliminando: boolean; error: string | null };

export default function ExtrasSection({ onShowToast }: Props) {
  const [extras,    setExtras]    = useState<TipoExtra[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<ModalState>({ open: false });
  const [eliminar,  setEliminar]  = useState<EliminarState>({ id: null });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await extrasService.getAll();
      setExtras(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const iniciarEliminar = (extra: TipoExtra) =>
    setEliminar({ id: extra.id, nombre: extra.nombre, confirmando: true, eliminando: false, error: null });

  const cancelarEliminar = () => setEliminar({ id: null });

  const confirmarEliminar = async () => {
    if (eliminar.id === null) return;
    const { id, nombre } = eliminar as { id: string; nombre: string; confirmando: boolean; eliminando: boolean; error: string | null };
    setEliminar(prev => ({ ...prev, confirmando: false, eliminando: true, error: null }));
    try {
      await extrasService.remove(id);
      onShowToast('success', 'Complemento eliminado', `"${nombre}" fue eliminado del catálogo.`);
      setEliminar({ id: null });
      cargar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      const texto = Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo eliminar el complemento.');
      setEliminar(prev => ({ ...prev, eliminando: false, error: texto }));
    }
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Complementos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catálogo de extras para maquinaria pesada (Martillo, Pluma hidráulica, etc.)
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, modo: 'crear' })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo complemento
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span className="text-sm">Cargando complementos…</span>
          </div>
        ) : extras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <p className="text-sm font-medium">No hay complementos en el catálogo</p>
            <p className="text-xs">Crea el primero con el botón de arriba.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Nombre</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Descripción</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Creado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extras.map(extra => {
                const esteEliminando = eliminar.id === extra.id;
                return (
                  <tr key={extra.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-800">{extra.nombre}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-500">{extra.descripcion ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-400">{formatFecha(extra.createdAt)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {esteEliminando && eliminar.id !== null ? (
                        <div className="flex flex-col items-end gap-1.5">
                          {(eliminar as any).error && (
                            <p className="text-[11px] text-red-600 text-right max-w-xs">{(eliminar as any).error}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">¿Eliminar "{extra.nombre}"?</span>
                            <button
                              onClick={cancelarEliminar}
                              disabled={(eliminar as any).eliminando}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={confirmarEliminar}
                              disabled={(eliminar as any).eliminando}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                            >
                              {(eliminar as any).eliminando && (
                                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                              )}
                              Sí, eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setModal({ open: true, modo: 'editar', tipoExtra: extra })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Editar"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => iniciarEliminar(extra)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs text-amber-800 leading-relaxed">
          Los complementos eliminados no pueden estar asignados a ningún equipo. El precio de cada complemento se configura individualmente por equipo desde la sección <span className="font-semibold">Equipos</span>.
        </p>
      </div>

      {/* Modal crear/editar */}
      {modal.open && (
        <TipoExtraModal
          modo={modal.modo}
          tipoExtra={modal.modo === 'editar' ? modal.tipoExtra : undefined}
          onClose={() => setModal({ open: false })}
          onGuardado={cargar}
          onShowToast={onShowToast}
        />
      )}

    </div>
  );
}
