// PasswordGeneradaModal.tsx — muestra la contraseña temporal generada al admin

import { useState } from 'react';

interface PasswordGeneradaModalProps {
  password: string;
  onClose: () => void;
}

export default function PasswordGeneradaModal({ password, onClose }: PasswordGeneradaModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Contraseña temporal generada</h2>
            <p className="text-xs text-slate-400 mt-0.5">Usuario creado exitosamente</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

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
                value={password}
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
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-xs text-amber-700">
              Esta contraseña es temporal. El usuario deberá cambiarla en su primer inicio de sesión.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
