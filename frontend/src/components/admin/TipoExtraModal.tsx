import { useState, useEffect } from 'react';
import { extrasService, type TipoExtra } from '../../services/equipos.service';
import type { ToastType } from '../../types/ui.types';

interface Props {
  modo:          'crear' | 'editar';
  tipoExtra?:    TipoExtra;
  onClose:       () => void;
  onGuardado:    () => void;
  onShowToast:   (type: ToastType, title: string, msg: string) => void;
}

interface FormState {
  nombre:      string;
  descripcion: string;
}

const INPUT_CLS = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:opacity-60 disabled:bg-slate-50';

export default function TipoExtraModal({ modo, tipoExtra, onClose, onGuardado, onShowToast }: Props) {
  const [form,     setForm]     = useState<FormState>({ nombre: '', descripcion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (modo === 'editar' && tipoExtra) {
      setForm({ nombre: tipoExtra.nombre, descripcion: tipoExtra.descripcion ?? '' });
    }
  }, [modo, tipoExtra]);

  const handleChange = (campo: keyof FormState, valor: string) =>
    setForm(prev => ({ ...prev, [campo]: valor }));

  const handleGuardar = async () => {
    setError(null);
    const nombre = form.nombre.trim();
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    if (nombre.length > 60) { setError('El nombre no puede superar 60 caracteres.'); return; }
    if (form.descripcion.length > 200) { setError('La descripción no puede superar 200 caracteres.'); return; }

    setGuardando(true);
    try {
      const dto = { nombre, descripcion: form.descripcion.trim() || undefined };
      if (modo === 'crear') {
        await extrasService.create(dto);
        onShowToast('success', 'Complemento creado', `"${nombre}" fue agregado al catálogo.`);
      } else {
        await extrasService.update(tipoExtra!.id, dto);
        onShowToast('success', 'Complemento actualizado', `"${nombre}" fue modificado correctamente.`);
      }
      onGuardado();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo guardar el complemento.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {modo === 'crear' ? 'Nuevo complemento' : 'Editar complemento'}
          </h2>
          <button onClick={onClose} disabled={guardando} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => handleChange('nombre', e.target.value)}
              placeholder="Ej: Martillo, Pluma hidráulica"
              maxLength={60}
              disabled={guardando}
              className={INPUT_CLS}
            />
            <p className="text-[10px] text-slate-400 mt-1">{form.nombre.trim().length}/60 caracteres</p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Descripción <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.descripcion}
              onChange={e => handleChange('descripcion', e.target.value)}
              placeholder="Descripción breve del complemento"
              maxLength={200}
              rows={3}
              disabled={guardando}
              className={`${INPUT_CLS} resize-none`}
            />
            <p className="text-[10px] text-slate-400 mt-1">{form.descripcion.length}/200 caracteres</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !form.nombre.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            {modo === 'crear' ? 'Crear complemento' : 'Guardar cambios'}
          </button>
        </div>

      </div>
    </div>
  );
}
