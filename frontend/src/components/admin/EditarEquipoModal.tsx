// EditarEquipoModal.tsx — editar datos de un equipo existente

import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo, TipoMaquinaria } from '../../types/equipo.types';
import { CATEGORIAS_EQUIPO } from '../../types/equipo.types';
import { equiposService } from '../../services/equipos.service';

interface EditarEquipoModalProps {
  equipo:  Equipo | null;
  open:    boolean;
  onClose: () => void;
  onSave:  (updated: Equipo) => void;
}

interface FormState {
  numeracion:  string;
  descripcion: string;
  categoria:   string;
  serie:       string;
  fechaCompra: string;
  montoCompra: string;
  tipo:        TipoMaquinaria | '';
  rentaDia:    string;
  rentaSemana: string;
  rentaMes:    string;
}

const TIPOS = [
  { value: 'LIVIANA',    label: 'Maquinaria Liviana' },
  { value: 'PESADA',     label: 'Maquinaria Pesada' },
  { value: 'USO_PROPIO', label: 'Uso Propio' },
];

export default function EditarEquipoModal({ equipo, open, onClose, onSave }: EditarEquipoModalProps) {
  const [form, setForm]         = useState<FormState>({} as FormState);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (equipo) {
      setForm({
        numeracion:  equipo.numeracion,
        descripcion: equipo.descripcion,
        categoria:   equipo.categoria,
        serie:       equipo.serie ?? '',
        fechaCompra: equipo.fechaCompra.substring(0, 10),
        montoCompra: equipo.montoCompra.toString(),
        tipo:        equipo.tipo,
        rentaDia:    equipo.rentaDia    != null ? equipo.rentaDia.toString()    : '',
        rentaSemana: equipo.rentaSemana != null ? equipo.rentaSemana.toString() : '',
        rentaMes:    equipo.rentaMes    != null ? equipo.rentaMes.toString()    : '',
      });
      setApiError(null);
    }
  }, [equipo]);

  if (!open || !equipo) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleSave = async () => {
    if (!form.numeracion.trim())  { setApiError('La numeración es requerida.'); return; }
    if (!form.descripcion.trim()) { setApiError('La descripción es requerida.'); return; }
    if (!form.categoria.trim())   { setApiError('La categoría es requerida.'); return; }
    if (!form.fechaCompra)        { setApiError('La fecha de compra es requerida.'); return; }
    const monto = parseFloat(form.montoCompra);
    if (isNaN(monto) || monto < 0) { setApiError('El monto de compra debe ser un número válido.'); return; }
    if (!form.tipo)               { setApiError('El tipo de maquinaria es requerido.'); return; }

    setIsSaving(true);
    setApiError(null);

    try {
      const updated = await equiposService.update(equipo.id, {
        numeracion:  form.numeracion.trim(),
        descripcion: form.descripcion.trim(),
        categoria:   form.categoria,
        serie:       form.serie.trim() || undefined,
        fechaCompra: form.fechaCompra,
        montoCompra: monto,
        tipo:        form.tipo as TipoMaquinaria,
        rentaDia:    form.rentaDia    ? parseFloat(form.rentaDia)    : undefined,
        rentaSemana: form.rentaSemana ? parseFloat(form.rentaSemana) : undefined,
        rentaMes:    form.rentaMes    ? parseFloat(form.rentaMes)    : undefined,
      });
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
            <h2 className="font-bold text-slate-800 text-base">Editar equipo</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">#{equipo.numeracion} · {equipo.categoria}</p>
          </div>
          <button onClick={onClose} disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body — mismo layout que AgregarEquipoModal */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Numeración</label>
                <input type="text" value={form.numeracion} onChange={handleChange('numeracion')}
                  disabled={isSaving} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={form.tipo} onChange={handleChange('tipo')} disabled={isSaving}
                  className={`${inputCls} bg-white`}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Categoría</label>
                <select value={form.categoria} onChange={handleChange('categoria')} disabled={isSaving}
                  className={`${inputCls} bg-white`}>
                  {CATEGORIAS_EQUIPO.map(c => <option key={c} value={c}>{c}</option>)}
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

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Precios de renta (Q)</p>
            <div className="grid grid-cols-3 gap-3">
              {(['rentaDia', 'rentaSemana', 'rentaMes'] as const).map((field, i) => (
                <div key={field}>
                  <label className={labelCls}>{['Por día', 'Por semana', 'Por mes'][i]}</label>
                  <input type="number" value={form[field]} onChange={handleChange(field)}
                    disabled={isSaving} min="0" step="0.01" className={`${inputCls} font-mono`} />
                </div>
              ))}
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
  );
}
