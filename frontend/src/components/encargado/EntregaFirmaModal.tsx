import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import SignaturePad from 'signature_pad';
import { solicitudesService } from '../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../types/solicitud.types';

interface EntregaFirmaModalProps {
  solicitud: SolicitudRenta | null;
  open:      boolean;
  onClose:   () => void;
  onConfirm: (updated: SolicitudRenta) => void;
}

export default function EntregaFirmaModal({ solicitud, open, onClose, onConfirm }: EntregaFirmaModalProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const padRef         = useRef<SignaturePad | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Inicializa el pad cuando el modal se abre
  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: 'rgb(255,255,255)',
      penColor:        'rgb(15, 23, 42)',
      minWidth:        1,
      maxWidth:        3,
    });

    pad.addEventListener('afterUpdateStroke', () => {
      setHasSignature(!pad.isEmpty());
    });

    padRef.current = pad;
    setHasSignature(false);

    // Ajusta el tamaño del canvas al contenedor
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
      canvas.width  = canvas.offsetWidth  * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
    };

    resizeCanvas();

    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [open]);

  if (!open || !solicitud) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) handleClose();
  };

  const handleClose = () => {
    if (isLoading) return;
    padRef.current?.clear();
    setHasSignature(false);
    setError(null);
    onClose();
  };

  const handleBorrarFirma = () => {
    padRef.current?.clear();
    setHasSignature(false);
  };

  const handleConfirmar = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return;

    const firmaBase64 = padRef.current.toDataURL('image/png');
    setIsLoading(true);
    setError(null);
    try {
      const updated = await solicitudesService.confirmarEntrega(solicitud.id, firmaBase64);
      onConfirm(updated);
      padRef.current?.clear();
      setHasSignature(false);
      onClose();
    } catch {
      setError('No se pudo registrar la entrega. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

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
            <p className="text-xs text-slate-500 mt-0.5">El cliente debe firmar confirmando la recepción</p>
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

          {/* Parte A: Resumen */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Detalle de la renta</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
                  <p className="text-xs font-mono text-slate-400">{solicitud.cliente.id}</p>
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
                        {unidadLabel(item.duracion, item.unidad)} desde {formatFechaCorta(item.fechaInicio)}
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
                        {unidadLabel(item.duracion, item.unidad)} desde {formatFechaCorta(item.fechaInicio)}
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

          {/* Parte B: Firma */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Firma del cliente
              </p>
              {hasSignature && (
                <button
                  onClick={handleBorrarFirma}
                  className="text-[11px] text-slate-400 hover:text-red-500 font-medium transition-colors"
                >
                  Borrar firma
                </button>
              )}
            </div>
            <div className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
              hasSignature ? 'border-indigo-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'
            }`}>
              <canvas
                ref={canvasRef}
                className="w-full touch-none"
                style={{ height: '180px', cursor: 'crosshair' }}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                    <span className="text-sm font-medium">El cliente firma aquí</span>
                  </div>
                </div>
              )}
            </div>
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

        {/* Footer sticky */}
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
            disabled={!hasSignature || isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Registrando...
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
