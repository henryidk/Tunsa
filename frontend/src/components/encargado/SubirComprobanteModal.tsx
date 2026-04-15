import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent, MouseEvent } from 'react';
import { solicitudesService } from '../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import { unidadLabel } from '../../types/solicitud.types';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface Props {
  solicitud: SolicitudRenta | null;
  open:      boolean;
  onClose:   () => void;
  onConfirm: (updated: SolicitudRenta) => void;
}

export default function SubirComprobanteModal({ solicitud, open, onClose, onConfirm }: Props) {
  const inputRef           = useRef<HTMLInputElement>(null);
  const [file,       setFile]       = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Handlers de archivo ───────────────────────────────────────────────────
  // Todos los handlers deben declararse ANTES de cualquier return condicional
  // para respetar las Reglas de Hooks de React.

  const validateAndSet = (f: File) => {
    setError(null);
    if (f.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.');
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError('El archivo supera el límite de 10 MB.');
      return;
    }
    setFile(f);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
  };

  // ── Confirmar upload ──────────────────────────────────────────────────────

  const handleReset = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (isLoading) return;
    handleReset();
    onClose();
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleConfirmar = async () => {
    if (!file || !solicitud) return;
    setIsLoading(true);
    setError(null);
    setProgress(0);
    try {
      const updated = await solicitudesService.confirmarEntrega(
        solicitud.id,
        file,
        (pct) => setProgress(pct),
      );
      onConfirm(updated);
      handleReset();
      onClose();
    } catch {
      setError('No se pudo registrar la entrega. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Early return después de todos los handlers — respeta las Reglas de Hooks
  if (!open || !solicitud) return null;

  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Entrega</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sube el comprobante firmado por el cliente</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scroll area */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Resumen de la renta */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Detalle de la renta</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
                  <p className="text-xs font-mono text-slate-400">{solicitud.folio}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-slate-800 font-mono">
                    Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {maquinaria.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs text-slate-700">
                        <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                        {item.descripcion}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {unidadLabel(item.duracion, item.unidad)}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 ml-4">
                      Q {(item.subtotal ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {granel.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
                        {item.tipoLabel}
                        {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {unidadLabel(item.duracion, item.unidad)}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 ml-4">
                      Q {(item.subtotal ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zona de upload */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Comprobante firmado (PDF)
            </p>

            {/* Drag & drop area */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-indigo-500">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {isDragging ? 'Suelta el archivo aquí' : 'Arrastra el PDF o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Solo PDF · Máximo 10 MB</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>
            ) : (
              /* Archivo seleccionado */
              <div className="flex items-center gap-3 px-4 py-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {!isLoading && (
                  <button
                    onClick={handleReset}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Barra de progreso */}
            {isLoading && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subiendo comprobante...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-red-600 font-medium">{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!file || isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Subiendo...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmar entrega
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
