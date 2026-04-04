// ConfirmDesactivarModal.tsx — confirmación antes de desactivar un usuario

import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Usuario } from '../../types/auth.types';
import { usuariosService } from '../../services/usuarios.service';

interface ConfirmDesactivarModalProps {
  usuario: Usuario | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (updated: Usuario) => void;
}

const rolLabel: Record<string, string> = {
  admin: 'Administrador',
  secretaria: 'Secretaria',
  encargado_maquinas: 'Enc. de Máquinas',
};

const rolGradient: Record<string, string> = {
  admin: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  secretaria: 'linear-gradient(135deg,#06b6d4,#0891b2)',
  encargado_maquinas: 'linear-gradient(135deg,#f59e0b,#d97706)',
};

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

export default function ConfirmDesactivarModal({ usuario, open, onClose, onConfirm }: ConfirmDesactivarModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !usuario) return null;

  const rolKey = usuario.role.nombre;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) onClose();
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await usuariosService.deactivate(usuario.id);
      onConfirm(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg ?? 'Ocurrió un error al desactivar el usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl">

        {/* Icono de advertencia */}
        <div className="flex flex-col items-center pt-8 pb-5 px-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">¿Desactivar usuario?</h2>
          <p className="text-sm text-slate-500 text-center">
            Esta acción impedirá que el usuario inicie sesión hasta que sea reactivado.
          </p>
        </div>

        {/* Info del usuario */}
        <div className="mx-6 mb-5 flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: rolGradient[rolKey] ?? '#94a3b8' }}
          >
            {getInitials(usuario.nombre)}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">{usuario.nombre}</div>
            <div className="text-xs text-slate-400 font-mono">@{usuario.username} · {rolLabel[rolKey] ?? rolKey}</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs text-red-600 font-medium">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Desactivando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                Desactivar cuenta
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
