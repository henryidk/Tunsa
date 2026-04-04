// ResetPasswordModal.tsx — restablecer contraseña de un usuario (admin)
// Dos estados: confirmación → contraseña temporal generada

import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Usuario } from '../../types/auth.types';
import { usuariosService } from '../../services/usuarios.service';

interface ResetPasswordModalProps {
  usuario: Usuario | null;
  open: boolean;
  onClose: () => void;
}

type ModalStep = 'confirm' | 'success';

const rolLabel: Record<string, string> = {
  admin:              'Administrador',
  secretaria:         'Secretaria',
  encargado_maquinas: 'Enc. de Máquinas',
};

const rolGradient: Record<string, string> = {
  admin:              'linear-gradient(135deg,#6366f1,#4f46e5)',
  secretaria:         'linear-gradient(135deg,#06b6d4,#0891b2)',
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

export default function ResetPasswordModal({ usuario, open, onClose }: ResetPasswordModalProps) {
  const [step, setStep]                     = useState<ModalStep>('confirm');
  const [isLoading, setIsLoading]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied]                 = useState(false);

  if (!open || !usuario) return null;

  const rolKey = usuario.role.nombre;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) handleClose();
  };

  const handleClose = () => {
    if (isLoading) return;
    // Resetear estado interno al cerrar
    setStep('confirm');
    setError(null);
    setTemporaryPassword('');
    setCopied(false);
    onClose();
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await usuariosService.resetPassword(usuario.id);
      setTemporaryPassword(result.temporaryPassword);
      setStep('success');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg ?? 'Ocurrió un error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  // ─── Tarjeta de usuario (reutilizada en ambos pasos) ───────────────────────
  const UserCard = () => (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: rolGradient[rolKey] ?? '#94a3b8' }}
      >
        {getInitials(usuario.nombre)}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-800">{usuario.nombre}</div>
        <div className="text-xs text-slate-400 font-mono">
          @{usuario.username} · {rolLabel[rolKey] ?? rolKey}
        </div>
      </div>
    </div>
  );

  // ─── Paso 1: Confirmación ──────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
        onClick={handleOverlayClick}
      >
        <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl">

          {/* Icono de advertencia */}
          <div className="flex flex-col items-center pt-8 pb-5 px-6">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-800 mb-1">¿Restablecer contraseña?</h2>
            <p className="text-sm text-slate-500 text-center">
              Se generará una contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
            </p>
          </div>

          {/* Tarjeta del usuario */}
          <div className="mx-6 mb-5">
            <UserCard />
          </div>

          {/* Aviso de sesión */}
          <div className="mx-6 mb-5 flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-xs text-amber-700">
              Si el usuario tiene sesión activa, será cerrada de inmediato.
            </span>
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
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Restableciendo...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Restablecer contraseña
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ─── Paso 2: Contraseña temporal generada ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Contraseña restablecida</h2>
            <p className="text-xs text-slate-400 mt-0.5">Nueva contraseña temporal generada</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Usuario */}
          <UserCard />

          <p className="text-sm text-slate-600">
            Comparte esta contraseña con el usuario. Solo se muestra una vez.
          </p>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Contraseña temporal
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={temporaryPassword}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-800 bg-slate-50 focus:outline-none select-all"
                onFocus={e => e.target.select()}
              />
              <button
                onClick={handleCopy}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs text-indigo-700">
              El usuario deberá cambiar esta contraseña temporal en su próximo inicio de sesión.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
