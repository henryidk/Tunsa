import { useState } from 'react';
import type { MouseEvent } from 'react';
import { solicitudesService } from '../../services/solicitudes.service';
import type { SolicitudRenta } from '../../types/solicitud-renta.types';

interface RechazarModalProps {
  solicitud: SolicitudRenta | null;
  open:      boolean;
  onClose:   () => void;
  onConfirm: (updated: SolicitudRenta) => void;
}

const MAX_CHARS = 500;

export default function RechazarModal({ solicitud, open, onClose, onConfirm }: RechazarModalProps) {
  const [motivo,    setMotivo]    = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  if (!open || !solicitud) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) handleClose();
  };

  const handleClose = () => {
    if (isLoading) return;
    setMotivo('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    const motivoTrimmed = motivo.trim();
    if (!motivoTrimmed) {
      setError('Debes escribir el motivo del rechazo.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updated = await solicitudesService.rechazar(solicitud.id, motivoTrimmed);
      onConfirm(updated);
      setMotivo('');
      onClose();
    } catch {
      setError('No se pudo rechazar la solicitud. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const restantes = MAX_CHARS - motivo.length;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl">

        {/* Icono + título */}
        <div className="flex flex-col items-center pt-8 pb-5 px-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Rechazar solicitud</h2>
          <p className="text-sm text-slate-500 text-center">
            El encargado recibirá el motivo indicado.
          </p>
        </div>

        {/* Resumen de la solicitud */}
        <div className="mx-6 mb-4 flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
          </div>
          <div className="ml-auto text-right flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Total</p>
            <p className="text-sm font-bold text-slate-700 font-mono">
              Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{solicitud.creadaPor}</p>
          </div>
        </div>

        {/* Motivo */}
        <div className="mx-6 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Motivo de rechazo
            </label>
            <span className={`text-[11px] font-mono ${restantes < 50 ? 'text-red-500' : 'text-slate-400'}`}>
              {restantes}
            </span>
          </div>
          <textarea
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setError(null); }}
            disabled={isLoading}
            maxLength={MAX_CHARS}
            rows={4}
            placeholder="Explica brevemente por qué se rechaza esta solicitud..."
            className="w-full resize-none border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50 transition-all disabled:opacity-60"
          />
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
            disabled={isLoading || motivo.trim().length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Rechazar
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
