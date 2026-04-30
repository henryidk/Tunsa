// AgregarEquipoModal.tsx — crear un nuevo equipo en el inventario

import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo, TipoConCategorias } from '../../types/equipo.types';
import { equiposService } from '../../services/equipos.service';

interface AgregarEquipoModalProps {
  open:      boolean;
  tipos:     TipoConCategorias[];
  onClose:   () => void;
  onCreated: (nuevo: Equipo) => void;
}

interface FormState {
  numeracion:  string;
  descripcion: string;
  tipoId:      string;
  categoriaId: string;
  serie:       string;
  fechaCompra: string;
  montoCompra: string;
  rentaDia:    string;
  rentaSemana: string;
  rentaMes:    string;
}

const emptyForm: FormState = {
  numeracion: '', descripcion: '', tipoId: '', categoriaId: '', serie: '',
  fechaCompra: '', montoCompra: '', rentaDia: '', rentaSemana: '', rentaMes: '',
};

export default function AgregarEquipoModal({ open, tipos, onClose, onCreated }: AgregarEquipoModalProps) {
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!open) return null;

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
    if (e.target === e.currentTarget && !isSaving) handleClose();
  };

  const handleClose = () => {
    if (isSaving) return;
    setForm(emptyForm);
    setApiError(null);
    onClose();
  };

  const handleSave = async () => {
    const numeracion  = form.numeracion.trim();
    const descripcion = form.descripcion.trim();
    const fechaCompra = form.fechaCompra;
    const montoCompra = parseFloat(form.montoCompra);

    if (!numeracion)                             { setApiError('La numeración es requerida.'); return; }
    if (!descripcion)                            { setApiError('La descripción es requerida.'); return; }
    if (!form.tipoId)                            { setApiError('El tipo de maquinaria es requerido.'); return; }
    if (!fechaCompra)                            { setApiError('La fecha de compra es requerida.'); return; }
    if (isNaN(montoCompra) || montoCompra < 0)  { setApiError('El monto de compra debe ser un número válido.'); return; }

    setIsSaving(true);
    setApiError(null);

    try {
      const nuevo = await equiposService.create({
        numeracion,
        descripcion,
        tipoId:      form.tipoId,
        categoriaId: form.categoriaId || undefined,
        serie:       form.serie.trim() || undefined,
        fechaCompra,
        montoCompra,
        rentaDia:    form.rentaDia    ? parseFloat(form.rentaDia)    : undefined,
        rentaSemana: form.rentaSemana ? parseFloat(form.rentaSemana) : undefined,
        rentaMes:    form.rentaMes    ? parseFloat(form.rentaMes)    : undefined,
      });
      onCreated(nuevo);
      setForm(emptyForm);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      setApiError(Array.isArray(msg) ? msg[0] : (msg ?? 'Ocurrió un error al crear el equipo.'));
    } finally {
      setIsSaving(false);
    }
  };

  const tipoSeleccionado = tipos.find(t => t.id === form.tipoId);
  const categoriasDelTipo = tipoSeleccionado?.categorias ?? [];

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[580px] shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Nuevo equipo</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registrar equipo en el inventario</p>
          </div>
          <button onClick={handleClose} disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

          {/* Identificación */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Numeración <span className="text-red-400">*</span></label>
                <input type="text" value={form.numeracion} onChange={handleChange('numeracion')}
                  disabled={isSaving} placeholder="Ej. 1, 47, MP01"
                  className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Tipo <span className="text-red-400">*</span></label>
                <select value={form.tipoId} onChange={handleChange('tipoId')} disabled={isSaving}
                  className={`${inputCls} bg-white`}>
                  <option value="">Seleccionar tipo...</option>
                  {tipos.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Categoría</label>
                <select value={form.categoriaId} onChange={handleChange('categoriaId')}
                  disabled={isSaving || !form.tipoId || categoriasDelTipo.length === 0}
                  className={`${inputCls} bg-white`}>
                  <option value="">
                    {!form.tipoId
                      ? 'Selecciona un tipo primero'
                      : categoriasDelTipo.length === 0
                        ? 'Sin categorías para este tipo'
                        : 'Sin categoría'}
                  </option>
                  {categoriasDelTipo.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Descripción del equipo <span className="text-red-400">*</span></label>
                <textarea value={form.descripcion} onChange={handleChange('descripcion')}
                  disabled={isSaving} placeholder="Ej. Bailarina Husqvarna con motor Honda GXR120"
                  rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {/* Serie */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Serie</p>
            <div>
              <label className={labelCls}>Serie equipo / motor</label>
              <input type="text" value={form.serie} onChange={handleChange('serie')}
                disabled={isSaving} placeholder="Ej. 20213400041 / GCAAH-5549003"
                className={`${inputCls} font-mono`} />
            </div>
          </div>

          {/* Compra */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Compra</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha de compra <span className="text-red-400">*</span></label>
                <input type="date" value={form.fechaCompra} onChange={handleChange('fechaCompra')}
                  disabled={isSaving} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto de compra (Q) <span className="text-red-400">*</span></label>
                <input type="number" value={form.montoCompra} onChange={handleChange('montoCompra')}
                  disabled={isSaving} placeholder="0.00" min="0" step="any"
                  className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          {/* Precios de renta */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Precios de renta (Q)</p>
            <div className="grid grid-cols-3 gap-3">
              {(['rentaDia', 'rentaSemana', 'rentaMes'] as const).map((field, i) => (
                <div key={field}>
                  <label className={labelCls}>{['Por día', 'Por semana', 'Por mes'][i]}</label>
                  <input type="number" value={form[field]} onChange={handleChange(field)}
                    disabled={isSaving} placeholder="0.00" min="0" step="any"
                    className={`${inputCls} font-mono`} />
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
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
          <button onClick={handleClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Agregar equipo</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
