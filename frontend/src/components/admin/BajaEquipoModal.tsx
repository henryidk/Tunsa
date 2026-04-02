// BajaEquipoModal.tsx — dar de baja un equipo del inventario

import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo } from '../../types/equipo.types';
import { TIPO_BADGE } from '../../types/equipo.types';
import { equiposService } from '../../services/equipos.service';

interface BajaEquipoModalProps {
  equipo:     Equipo | null;
  open:       boolean;
  onClose:    () => void;
  onConfirm:  (updated: Equipo) => void;
}

export default function BajaEquipoModal({ equipo, open, onClose, onConfirm }: BajaEquipoModalProps) {
  const [motivo, setMotivo]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  if (!open || !equipo) return null;

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
    setIsLoading(true);
    setError(null);
    try {
      const updated = await equiposService.darDeBaja(equipo.id, { motivo: motivo.trim() || undefined });
      onConfirm(updated);
      setMotivo('');
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg ?? 'Ocurrió un error al dar de baja el equipo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl">

        {/* Icono advertencia */}
        <div className="flex flex-col items-center pt-8 pb-5 px-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">¿Dar de baja este equipo?</h2>
          <p className="text-sm text-slate-500 text-center">
            El equipo quedará registrado como inactivo en el inventario.
          </p>
        </div>

        {/* Info del equipo */}
        <div className="mx-6 mb-4 flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-600 font-mono">#{equipo.numeracion}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 leading-tight truncate">{equipo.descripcion}</div>
            <div className="flex items-center gap-2 mt-1">
              {equipo.categoria && (
                <span className="text-xs text-slate-400">{equipo.categoria.nombre}</span>
              )}
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE[equipo.tipo.nombre] ?? 'bg-slate-100 text-slate-600'}`}>
                {equipo.tipo.nombre.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Motivo */}
        <div className="mx-6 mb-5">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Motivo de baja <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={motivo}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { setMotivo(e.target.value); setError(null); }}
            disabled={isLoading}
            placeholder="Ej. Robado, Vendido a cliente, Irreparable..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50 transition-all disabled:opacity-60"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-xs text-red-600 font-medium">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={handleClose} disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isLoading ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Procesando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Dar de baja</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
