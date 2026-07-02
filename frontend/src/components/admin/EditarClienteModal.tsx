// EditarClienteModal.tsx — editar datos de un cliente existente

import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { clientesService } from '../../services/clientes.service';
import type { Cliente } from '../../services/clientes.service';
import { formatDpi, formatTelefono } from '../../utils/clientes.utils';
import { extractApiError } from '../../utils/usuario.utils';
import EspecialBadge from '../shared/EspecialBadge';

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onSave:  (cliente: Cliente) => void;
}

interface FormState {
  nombre:     string;
  dpi:        string;
  telefono:   string;
  esEspecial: boolean;
}

export default function EditarClienteModal({ cliente, onClose, onSave }: Props) {
  const [form,            setForm]            = useState<FormState>({ nombre: '', dpi: '', telefono: '', esEspecial: false });
  const [isSaving,        setIsSaving]        = useState(false);
  const [apiError,        setApiError]        = useState<string | null>(null);
  const [confirmEspecial, setConfirmEspecial] = useState(false);

  useEffect(() => {
    if (cliente) {
      setForm({
        nombre:     cliente.nombre,
        dpi:        formatDpi(cliente.dpi ?? ''),
        telefono:   formatTelefono(cliente.telefono ?? ''),
        esEspecial: cliente.esEspecial,
      });
      setApiError(null);
      setConfirmEspecial(false);
    }
  }, [cliente]);

  if (!cliente) return null;

  const dpiDigits      = form.dpi.replace(/\D/g, '').length;
  const telefonoDigits = form.telefono.replace(/\D/g, '').length;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleDpiChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, dpi: formatDpi(e.target.value) }));
    setApiError(null);
  };

  const handleTelefonoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, telefono: formatTelefono(e.target.value) }));
    setApiError(null);
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleSave = async () => {
    const nombreTrim = form.nombre.trim();
    const dpiClean   = form.dpi.replace(/\D/g, '');

    if (!nombreTrim)           { setApiError('El nombre es requerido.'); return; }
    if (!form.esEspecial) {
      if (!dpiClean)               { setApiError('El DPI es requerido.'); return; }
      if (dpiClean.length !== 13)  { setApiError('El DPI debe tener exactamente 13 dígitos.'); return; }
    }
    if (telefonoDigits !== 8)  { setApiError('El teléfono debe tener exactamente 8 dígitos.'); return; }

    setIsSaving(true);
    setApiError(null);
    try {
      const updated = await clientesService.update(cliente.id, {
        nombre:     nombreTrim,
        dpi:        dpiClean || undefined,
        telefono:   form.telefono.replace(/\D/g, ''),
        esEspecial: form.esEspecial,
      });
      onSave(updated);
      onClose();
    } catch (err) {
      setApiError(extractApiError(err, 'Ocurrió un error inesperado.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertir = () => {
    setForm(prev => ({ ...prev, esEspecial: !prev.esEspecial }));
    setConfirmEspecial(false);
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative bg-white rounded-2xl w-full max-w-[480px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-base">Editar cliente</h2>
              {form.esEspecial && <EspecialBadge />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Código: <code className="font-mono bg-slate-100 px-1 rounded text-slate-600">{cliente.id}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input
              type="text"
              value={form.nombre}
              onChange={handleChange('nombre')}
              placeholder="Ej. Juan Carlos Pérez López"
              disabled={isSaving}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>DPI <span className="text-slate-400 font-normal">(13 dígitos)</span></label>
            <div className="relative">
              <input
                type="text"
                value={form.dpi}
                onChange={handleDpiChange}
                placeholder="0000 00000 0101"
                maxLength={17}
                disabled={isSaving}
                className={`${inputCls} font-mono tracking-widest pr-16`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none transition-colors ${
                dpiDigits === 13 ? 'text-emerald-500' : dpiDigits > 0 ? 'text-slate-400' : 'text-slate-300'
              }`}>
                {dpiDigits} / 13
              </span>
            </div>
          </div>

          <div>
            <label className={labelCls}>Teléfono <span className="text-slate-400 font-normal">(8 dígitos)</span></label>
            <div className="relative">
              <input
                type="tel"
                value={form.telefono}
                onChange={handleTelefonoChange}
                placeholder="5555-0000"
                maxLength={9}
                disabled={isSaving}
                className={`${inputCls} font-mono pr-14`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none transition-colors ${
                telefonoDigits === 8 ? 'text-emerald-500' : telefonoDigits > 0 ? 'text-slate-400' : 'text-slate-300'
              }`}>
                {telefonoDigits} / 8
              </span>
            </div>
          </div>

          {/* Toggle cliente especial */}
          <button
            type="button"
            onClick={() => setConfirmEspecial(true)}
            disabled={isSaving}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors disabled:opacity-50 ${
              form.esEspecial
                ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg
                width="15" height="15" viewBox="0 0 24 24"
                fill={form.esEspecial ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2"
                className={form.esEspecial ? 'text-amber-500 flex-shrink-0' : 'text-slate-400 flex-shrink-0'}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div className="text-left">
                <p className={`text-xs font-semibold ${form.esEspecial ? 'text-amber-800' : 'text-slate-600'}`}>
                  Cliente especial
                </p>
                <p className={`text-[10px] ${form.esEspecial ? 'text-amber-600' : 'text-slate-400'}`}>
                  {form.esEspecial ? 'DPI opcional · sin restricciones de documentación' : 'DPI y documentación requeridos'}
                </p>
              </div>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              form.esEspecial ? 'bg-amber-400' : 'bg-slate-300'
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                form.esEspecial ? 'left-[18px]' : 'left-0.5'
              }`} />
            </div>
          </button>

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
        <div className="flex items-center justify-between gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Guardar cambios
              </>
            )}
          </button>
        </div>

        {/* Confirmación: cambiar tipo de cliente */}
        {confirmEspecial && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-base">
                      {form.esEspecial ? 'Revertir a cliente regular' : 'Marcar como especial'}
                    </h3>
                    {!form.esEspecial && <EspecialBadge />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{cliente.id} · {cliente.nombre}</p>
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm text-slate-600">
                  ¿Estás seguro de que deseas realizar este cambio?
                </p>
              </div>

              <div className="flex items-center gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                <button
                  onClick={() => setConfirmEspecial(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConvertir}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    form.esEspecial
                      ? 'bg-slate-600 hover:bg-slate-700'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  Confirmar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
