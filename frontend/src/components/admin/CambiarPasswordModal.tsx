// CambiarPasswordModal.tsx — modal bloqueante para cambio de contraseña en primer login

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { usuariosService } from '../../services/usuarios.service';
import { useAuthStore } from '../../store/auth.store';

export default function CambiarPasswordModal() {
  const setMustChangePassword = useAuthStore(s => s.setMustChangePassword);

  const [newPassword, setNewPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await usuariosService.changePassword(newPassword);
      setMustChangePassword(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Ocurrió un error. Intenta de nuevo.'));
    } finally {
      setIsSaving(false);
    }
  };

  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {visible ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Cambiar contraseña</h2>
            <p className="text-xs text-slate-400 mt-0.5">Debes establecer una nueva contraseña para continuar</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs text-indigo-700">
              Por seguridad, debes cambiar tu contraseña temporal antes de usar el sistema.
            </span>
          </div>

          {/* Nueva contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Nueva contraseña <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); setError(null); }}
                disabled={isSaving}
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-slate-200 rounded-lg px-3 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Confirmar contraseña <span className="text-red-400">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmar}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setConfirmar(e.target.value); setError(null); }}
              disabled={isSaving}
              placeholder="Repite la nueva contraseña"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-xs text-red-600 font-medium">{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Guardando...
              </>
            ) : (
              'Guardar contraseña'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
