import { useState } from 'react';
import type { MouseEvent } from 'react';
import { solicitudesService } from '../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../types/solicitud.types';

interface AprobarModalProps {
  solicitud: SolicitudRenta | null;
  open:      boolean;
  onClose:   () => void;
  onConfirm: (updated: SolicitudRenta) => void;
}

export default function AprobarModal({ solicitud, open, onClose, onConfirm }: AprobarModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  if (!open || !solicitud) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) handleClose();
  };

  const handleClose = () => {
    if (isLoading) return;
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await solicitudesService.aprobar(solicitud.id);
      onConfirm(updated);
      onClose();
    } catch {
      setError('No se pudo aprobar la solicitud. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl">

        {/* Ícono + título */}
        <div className="flex flex-col items-center pt-8 pb-5 px-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Aprobar solicitud</h2>
          <p className="text-sm text-slate-500 text-center">
            El encargado recibirá la notificación y deberá coordinar la entrega con el cliente.
          </p>
        </div>

        {/* Resumen cliente */}
        <div className="mx-6 mb-4 flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Total</p>
            <p className="text-sm font-bold text-slate-700 font-mono">
              Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Solicitado por {solicitud.creadaPor}</p>
          </div>
        </div>

        {/* Ítems */}
        <div className="mx-6 mb-5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Ítems a aprobar</p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {maquinaria.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white">
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
              <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white">
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

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-xs text-red-600 font-medium">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmar aprobación
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
