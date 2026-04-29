// RegistrarClienteModal.tsx — registrar un nuevo cliente

import { useState, useRef } from 'react';
import type { ChangeEvent, MouseEvent, DragEvent } from 'react';
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

const DOCS = [
  'DPI (Documento Personal de Identificación)',
  'Patente de Comercio',
  'RTU (Registro Tributario Unificado)',
  'Referencias Comerciales',
  'Referencias Personales',
];

export default function RegistrarClienteModal({ open, onClose, onSave }: Props) {
  const [step,       setStep]       = useState<1 | 2>(1);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);
  const [file,        setFile]        = useState<File | null>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [confirmSinDoc, setConfirmSinDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleDpiChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 13);
    let fmt = raw;
    if (raw.length > 4) fmt = raw.slice(0, 4) + ' ' + raw.slice(4);
    if (raw.length > 9) fmt = raw.slice(0, 4) + ' ' + raw.slice(4, 9) + ' ' + raw.slice(9);
    setForm(prev => ({ ...prev, dpi: fmt }));
    setApiError(null);
  };

  const handleTelefonoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const fmt = digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits;
    setForm(prev => ({ ...prev, telefono: fmt }));
    setApiError(null);
  };

  const dpiDigits      = form.dpi.replace(/\D/g, '').length;
  const telefonoDigits = form.telefono.replace(/\D/g, '').length;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving && !isChecking) handleClose();
  };

  const extractApiError = (err: unknown): string => {
    if (err && typeof err === 'object' && 'response' in err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) return msg;
    }
    return 'Ocurrió un error inesperado.';
  };

  const handleSaveWithoutDoc = () => registrarCliente(false);

  const handleClose = () => {
    setStep(1);
    setForm(EMPTY);
    setApiError(null);
    setFile(null);
    setIsDragging(false);
    setConfirmSinDoc(false);
    onClose();
  };

  const handleNext = async () => {
    const dpiClean = form.dpi.replace(/\D/g, '');
    if (!form.nombre.trim())         { setApiError('El nombre es requerido.'); return; }
    if (!dpiClean)                   { setApiError('El DPI es requerido.'); return; }
    if (dpiClean.length !== 13)      { setApiError('El DPI debe tener exactamente 13 dígitos numéricos.'); return; }
    if (telefonoDigits !== 8)        { setApiError('El teléfono debe tener exactamente 8 dígitos.'); return; }

    setIsChecking(true);
    setApiError(null);
    try {
      const { exists } = await clientesService.checkDpi(dpiClean);
      if (exists) {
        setApiError('Ya existe un cliente registrado con ese DPI.');
        return;
      }
      setStep(2);
    } catch {
      setApiError('No se pudo verificar el DPI. Intenta de nuevo.');
    } finally {
      setIsChecking(false);
    }
  };

  const registrarCliente = async (conDocumento: boolean) => {
    const dpiClean = form.dpi.replace(/\D/g, '');
    setConfirmSinDoc(false);
    setIsSaving(true);
    setApiError(null);

    try {
      const cliente = await clientesService.create({
        nombre:   form.nombre.trim(),
        dpi:      dpiClean,
        telefono: form.telefono.replace(/\D/g, ''),
      });

      if (conDocumento && file) {
        try {
          await clientesService.uploadDocumento(cliente.id, file);
          cliente.documentoKey = `clientes/${cliente.id}/documento.pdf`;
        } catch {
          // Cliente creado pero falló el upload — registrar sin doc y avisar
          onSave(cliente);
          handleClose();
          return;
        }
      }

      onSave(cliente);
      handleClose();
    } catch (err: unknown) {
      setApiError(extractApiError(err));
      setStep(1);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!file) { setConfirmSinDoc(true); return; }
    await registrarCliente(true);
  };

  const handleFilePick = (picked: File | null | undefined) => {
    if (!picked) return;
    if (picked.type !== 'application/pdf') return;
    setFile(picked);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilePick(e.dataTransfer.files[0]);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'
            }`}>
              {step === 1 ? '1' : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span className={`text-xs font-semibold ${step === 1 ? 'text-indigo-600' : 'text-emerald-500'}`}>
              Datos
            </span>
          </div>

          <div className={`flex-1 mx-3 h-px transition-colors ${step === 2 ? 'bg-emerald-400' : 'bg-slate-200'}`} />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
            }`}>
              2
            </div>
            <span className={`text-xs font-semibold ${step === 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
              Documentación
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* ── Paso 1: Datos básicos ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input type="text" value={form.nombre} onChange={handleChange('nombre')}
                  placeholder="Ej. Juan Carlos Pérez López"
                  disabled={isSaving} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>DPI <span className="text-slate-400 font-normal">(13 dígitos)</span></label>
                <div className="relative">
                  <input type="text" value={form.dpi} onChange={handleDpiChange}
                    placeholder="0000 00000 0101"
                    maxLength={17} disabled={isSaving}
                    className={`${inputCls} font-mono tracking-widest pr-16`} />
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
                  <input type="tel" value={form.telefono} onChange={handleTelefonoChange}
                    placeholder="5555-0000"
                    maxLength={9} disabled={isSaving}
                    className={`${inputCls} font-mono pr-14`} />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none transition-colors ${
                    telefonoDigits === 8 ? 'text-emerald-500' : telefonoDigits > 0 ? 'text-slate-400' : 'text-slate-300'
                  }`}>
                    {telefonoDigits} / 8
                  </span>
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
          )}

          {/* ── Paso 2: Documentación ── */}
          {step === 2 && (
            <div className="space-y-4">

              {/* Aviso */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-xs text-blue-700">
                  Sube un <strong>único PDF</strong> con toda la documentación del cliente.
                </span>
              </div>

              {/* Checklist */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">El PDF debe incluir</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {DOCS.map(doc => (
                    <li key={doc} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="text-xs text-slate-600">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Upload zone */}
              {file ? (
                /* Archivo seleccionado */
                <div className="flex items-center gap-3 px-4 py-3.5 border border-emerald-200 bg-emerald-50 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ) : (
                /* Zona de drop */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="13" x2="12" y2="18"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-indigo-600">Arrastra el PDF aquí</span> o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Solo PDF</p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => handleFilePick(e.target.files?.[0])}
              />

              {apiError && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="text-xs text-red-600 font-medium">{apiError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">

          {step === 1 ? (
            <>
              <button onClick={handleClose} disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={handleNext} disabled={isChecking}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {isChecking ? (
                  <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Verificando...</>
                ) : (
                  <>Siguiente<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                )}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep(1); setApiError(null); }} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Atrás
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {isSaving ? (
                  <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Registrando...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Registrar cliente</>
                )}
              </button>
            </>
          )}

        </div>

      </div>

      {/* Modal de advertencia: sin documentación */}
      {confirmSinDoc && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">

            <div className="flex flex-col items-center pt-7 pb-4 px-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-base text-center">Sin documentación</h3>
              <p className="text-sm text-slate-500 text-center mt-2">
                No has subido ningún documento PDF. ¿Deseas registrar al cliente de todas formas?
              </p>
            </div>

            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setConfirmSinDoc(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleSaveWithoutDoc}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                Registrar sin PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
