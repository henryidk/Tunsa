// EditarEquipoModal.tsx — editar datos de un equipo existente

import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo, TipoConCategorias } from '../../types/equipo.types';
import { TIPO_LABEL } from '../../types/equipo.types';
import { equiposService } from '../../services/equipos.service';

interface EditarEquipoModalProps {
  equipo:  Equipo | null;
  open:    boolean;
  tipos:   TipoConCategorias[];
  onClose: () => void;
  onSave:  (updated: Equipo) => void;
}

interface FormState {
  numeracion:  string;
  descripcion: string;
  tipoId:      string;
  categoriaId: string;
  serie:       string;
  cantidad:    string;
  fechaCompra: string;
  montoCompra: string;
}

export default function EditarEquipoModal({ equipo, open, tipos, onClose, onSave }: EditarEquipoModalProps) {
  const [form, setForm]                   = useState<FormState>({} as FormState);
  const [isSaving, setIsSaving]           = useState(false);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [confirmarTipo, setConfirmarTipo] = useState(false);

  useEffect(() => {
    if (equipo) {
      setForm({
        numeracion:  equipo.numeracion,
        descripcion: equipo.descripcion,
        tipoId:      equipo.tipoId,
        categoriaId: equipo.categoriaId ?? '',
        serie:       equipo.serie ?? '',
        cantidad:    equipo.cantidad.toString(),
        fechaCompra: equipo.fechaCompra.substring(0, 10),
        montoCompra: equipo.montoCompra.toString(),
      });
      setApiError(null);
    }
  }, [equipo]);

  if (!open || !equipo) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm(prev => ({
        ...prev,
        [field]: value,
        // reset categoría cuando cambia el tipo
        ...(field === 'tipoId' ? { categoriaId: '' } : {}),
      }));
      setApiError(null);
    };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const doSave = async () => {
    setIsSaving(true);
    setApiError(null);
    setConfirmarTipo(false);

    // Solo enviar los campos que realmente cambiaron (PATCH semántico correcto)
    const payload: Record<string, unknown> = {};

    const descripcion = form.descripcion.trim();
    if (descripcion !== equipo.descripcion) payload.descripcion = descripcion;

    if (form.tipoId !== equipo.tipoId) payload.tipoId = form.tipoId;

    const categoriaId = form.categoriaId || null;
    if (categoriaId !== equipo.categoriaId) payload.categoriaId = categoriaId;

    const serie = form.serie.trim() || null;
    if (serie !== (equipo.serie ?? null)) payload.serie = serie ?? undefined;

    const cantidad = parseInt(form.cantidad) || 1;
    if (cantidad !== equipo.cantidad) payload.cantidad = cantidad;

    if (form.fechaCompra !== equipo.fechaCompra.substring(0, 10)) payload.fechaCompra = form.fechaCompra;

    const monto = parseFloat(form.montoCompra);
    if (monto !== equipo.montoCompra) payload.montoCompra = monto;

    if (Object.keys(payload).length === 0) { onClose(); return; }

    try {
      const updated = await equiposService.update(equipo.id, payload);
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setApiError(msg ?? 'Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!form.descripcion.trim()) { setApiError('La descripción es requerida.'); return; }
    if (!form.tipoId)             { setApiError('El tipo de maquinaria es requerido.'); return; }
    if (!form.fechaCompra)        { setApiError('La fecha de compra es requerida.'); return; }
    const monto = parseFloat(form.montoCompra);
    if (isNaN(monto) || monto < 0) { setApiError('El monto de compra debe ser un número válido.'); return; }

    // Si el tipo cambió, pedir confirmación antes de guardar
    if (form.tipoId !== equipo.tipoId) {
      setConfirmarTipo(true);
      return;
    }
    doSave();
  };

  const tipoSeleccionado  = tipos.find(t => t.id === form.tipoId);
  const categoriasDelTipo = tipoSeleccionado?.categorias ?? [];

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <>
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[580px] shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Editar equipo</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              #{equipo.numeracion}{equipo.categoria ? ` · ${equipo.categoria.nombre}` : ''}
            </p>
          </div>
          <button onClick={onClose} disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Numeración</label>
                <div className={`${inputCls} font-mono bg-slate-50 text-slate-500 cursor-not-allowed select-none`}>
                  {form.numeracion}
                </div>
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={form.tipoId} onChange={handleChange('tipoId')} disabled={isSaving}
                  className={`${inputCls} bg-white`}>
                  {tipos.map(t => (
                    <option key={t.id} value={t.id}>
                      {TIPO_LABEL[t.nombre] ?? t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cantidad</label>
                <input type="number" value={form.cantidad} onChange={handleChange('cantidad')}
                  disabled={isSaving} min="1" step="1"
                  className={`${inputCls} font-mono`} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Categoría</label>
                <select value={form.categoriaId} onChange={handleChange('categoriaId')}
                  disabled={isSaving || categoriasDelTipo.length === 0}
                  className={`${inputCls} bg-white`}>
                  <option value="">
                    {categoriasDelTipo.length === 0 ? 'Sin categorías para este tipo' : 'Sin categoría'}
                  </option>
                  {categoriasDelTipo.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Descripción del equipo</label>
                <textarea value={form.descripcion} onChange={handleChange('descripcion')}
                  disabled={isSaving} rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Serie</p>
            <div>
              <label className={labelCls}>Serie equipo / motor</label>
              <input type="text" value={form.serie} onChange={handleChange('serie')}
                disabled={isSaving} className={`${inputCls} font-mono`} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Compra</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha de compra</label>
                <input type="date" value={form.fechaCompra} onChange={handleChange('fechaCompra')}
                  disabled={isSaving} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto de compra (Q)</label>
                <input type="number" value={form.montoCompra} onChange={handleChange('montoCompra')}
                  disabled={isSaving} min="0" step="0.01" className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          {apiError && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-red-600 font-medium">{apiError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Guardar cambios</>
            )}
          </button>
        </div>

      </div>
    </div>

    {/* Diálogo de confirmación — cambio de tipo */}
    {confirmarTipo && (
      <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">¿Cambiar tipo de maquinaria?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Estás moviendo el equipo{' '}
                <span className="font-semibold text-slate-700">#{equipo.numeracion}</span> de{' '}
                <span className="font-semibold text-slate-700">{TIPO_LABEL[equipo.tipo.nombre] ?? equipo.tipo.nombre}</span> a{' '}
                <span className="font-semibold text-slate-700">{TIPO_LABEL[tipos.find(t => t.id === form.tipoId)?.nombre ?? ''] ?? form.tipoId}</span>.
              </p>
              {equipo.categoriaId && (
                <p className="text-xs text-amber-600 font-medium mt-2">
                  La categoría actual será removida al cambiar el tipo.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmarTipo(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={doSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              Sí, cambiar tipo
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
