// RegistrarClienteModal.tsx — registrar un nuevo cliente

import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { clientesService } from '../../services/clientes.service';
import type { Cliente } from '../../services/clientes.service';

interface Props {
  open:    boolean;
  onClose: () => void;
  onSave:  (cliente: Cliente) => void;
}

interface FormState {
  nombre:   string;
  dpi:      string;
  telefono: string;
}

const EMPTY: FormState = { nombre: '', dpi: '', telefono: '' };

export default function RegistrarClienteModal({ open, onClose, onSave }: Props) {
  const [form, setForm]         = useState<FormState>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!open) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) handleClose();
  };

  const handleClose = () => {
    setForm(EMPTY);
    setApiError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!form.nombre.trim())    { setApiError('El nombre es requerido.'); return; }
    if (!form.dpi.trim())       { setApiError('El DPI es requerido.'); return; }
    if (!/^\d{13}$/.test(form.dpi.trim())) {
      setApiError('El DPI debe tener exactamente 13 dígitos numéricos.');
      return;
    }

    setIsSaving(true);
    setApiError(null);

    try {
      const cliente = await clientesService.create({
        nombre:   form.nombre.trim(),
        dpi:      form.dpi.trim(),
        telefono: form.telefono.trim() || undefined,
      });
      onSave(cliente);
      handleClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setApiError(msg ?? 'Ocurrió un error al registrar el cliente.');
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
      <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Registrar cliente</h2>
            <p className="text-xs text-slate-400 mt-0.5">El código se genera automáticamente</p>
          </div>
          <button onClick={handleClose} disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input type="text" value={form.nombre} onChange={handleChange('nombre')}
              placeholder="Ej. Juan Carlos Pérez López"
              disabled={isSaving} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>DPI <span className="text-slate-400 font-normal">(13 dígitos)</span></label>
            <input type="text" value={form.dpi} onChange={handleChange('dpi')}
              placeholder="0000000000000"
              maxLength={13} disabled={isSaving}
              className={`${inputCls} font-mono tracking-widest`} />
          </div>

          <div>
            <label className={labelCls}>Teléfono <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input type="tel" value={form.telefono} onChange={handleChange('telefono')}
              placeholder="Ej. 5555-0000"
              disabled={isSaving} className={`${inputCls} font-mono`} />
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
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={handleClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Registrando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Registrar cliente</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
