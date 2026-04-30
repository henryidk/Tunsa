import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { granelService } from '../../services/granel.service';
import type { LoteGranel, TipoGranel } from '../../services/granel.service';

interface Props {
  tipo:      TipoGranel;
  tipoLabel: string;
  open:      boolean;
  onClose:   () => void;
  onCreated: (lote: LoteGranel) => void;
}

interface FormState {
  descripcion:    string;
  cantidad:       string;
  precioUnitario: string;
  fechaCompra:    string;
  ubicacion:      string;
}

const emptyForm: FormState = {
  descripcion: '', cantidad: '', precioUnitario: '', fechaCompra: '', ubicacion: '',
};

const extractApiError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (msg) return msg;
  }
  return 'Ocurrió un error inesperado.';
};

export default function AgregarLoteGranelModal({ tipo, tipoLabel, open, onClose, onCreated }: Props) {
  const [form,     setForm]     = useState<FormState>(emptyForm);
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
    if (isSaving) return;
    setForm(emptyForm);
    setApiError(null);
    onClose();
  };

  const montoTotal = (() => {
    const cant   = parseInt(form.cantidad)         || 0;
    const precio = parseFloat(form.precioUnitario) || 0;
    return cant * precio;
  })();

  const handleSave = async () => {
    const descripcion    = form.descripcion.trim();
    const cantidad       = parseInt(form.cantidad);
    const precioUnitario = parseFloat(form.precioUnitario);

    if (!descripcion)              { setApiError('La descripción es requerida.'); return; }
    if (!cantidad || cantidad < 1) { setApiError('La cantidad debe ser al menos 1.'); return; }
    if (isNaN(precioUnitario) || precioUnitario < 0) { setApiError('El precio unitario debe ser un número válido.'); return; }

    setIsSaving(true);
    setApiError(null);
    try {
      const lote = await granelService.create({
        tipo,
        descripcion,
        cantidad,
        precioUnitario,
        fechaCompra: form.fechaCompra || undefined,
        ubicacion:   form.ubicacion.trim() || undefined,
      });
      onCreated(lote);
      setForm(emptyForm);
      onClose();
    } catch (err) {
      setApiError(extractApiError(err));
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
            <h2 className="font-bold text-slate-800 text-base">Nuevo lote — {tipoLabel}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registrar compra para el historial de inventario</p>
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
            <label className={labelCls}>Descripción <span className="text-red-400">*</span></label>
            <input type="text" value={form.descripcion} onChange={handleChange('descripcion')}
              placeholder={`Ej. ${tipoLabel} metálicos`} disabled={isSaving} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cantidad <span className="text-red-400">*</span></label>
              <input type="number" value={form.cantidad} onChange={handleChange('cantidad')}
                placeholder="0" min="1" step="1" disabled={isSaving}
                className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Precio unitario (Q) <span className="text-red-400">*</span></label>
              <input type="number" value={form.precioUnitario} onChange={handleChange('precioUnitario')}
                placeholder="0.00" min="0" step="any" disabled={isSaving}
                className={`${inputCls} font-mono`} />
            </div>
          </div>

          {montoTotal > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500">Monto total del lote</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                Q{montoTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de compra <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input type="date" value={form.fechaCompra} onChange={handleChange('fechaCompra')}
                disabled={isSaving} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ubicación <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input type="text" value={form.ubicacion} onChange={handleChange('ubicacion')}
                placeholder="Ej. Bodega 2" disabled={isSaving} className={inputCls} />
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
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={handleClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Agregar lote</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
