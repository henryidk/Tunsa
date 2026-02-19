// EditarUsuarioModal.tsx — modal para editar datos de un usuario

import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Usuario } from '../../types/auth.types';
import { usuariosService } from '../../services/usuarios.service';

interface EditarUsuarioModalProps {
  usuario: Usuario | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Usuario) => void;
}

const rolLabel: Record<string, string> = {
  admin: 'Administrador',
  secretaria: 'Secretaria',
  encargado_maquinas: 'Enc. de Máquinas',
  colaborador: 'Colaborador',
};

const rolBadge: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800',
  secretaria: 'bg-sky-100 text-sky-700',
  encargado_maquinas: 'bg-indigo-100 text-indigo-700',
  colaborador: 'bg-green-100 text-green-700',
};

const rolGradient: Record<string, string> = {
  admin: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  secretaria: 'linear-gradient(135deg,#06b6d4,#0891b2)',
  colaborador: 'linear-gradient(135deg,#10b981,#059669)',
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

interface FormState {
  nombre: string;
  username: string;
  telefono: string;
}

export default function EditarUsuarioModal({ usuario, open, onClose, onSave }: EditarUsuarioModalProps) {
  const [form, setForm] = useState<FormState>({ nombre: '', username: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sincronizar form cada vez que cambia el usuario seleccionado
  useEffect(() => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre,
        username: usuario.username,
        telefono: usuario.telefono ?? '',
      });
      setApiError(null);
    }
  }, [usuario]);

  if (!open || !usuario) return null;

  const rolKey = usuario.role.nombre;

  const handleChange = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setApiError(null);
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    const username = form.username.trim();
    const telefono = form.telefono.trim();

    if (!nombre) { setApiError('El nombre no puede estar vacío.'); return; }
    if (!username) { setApiError('El nombre de usuario no puede estar vacío.'); return; }

    setIsSaving(true);
    setApiError(null);

    try {
      const updated = await usuariosService.update(usuario.id, { nombre, username, telefono });
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setApiError(msg ?? 'Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: rolGradient[rolKey] ?? '#94a3b8' }}
            >
              {getInitials(usuario.nombre)}
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm leading-tight">{usuario.nombre}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400 font-mono">@{usuario.username}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${rolBadge[rolKey] ?? 'bg-slate-100 text-slate-600'}`}>
                  {rolLabel[rolKey] ?? rolKey}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

          {/* Información personal */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Información personal
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={handleChange('nombre')}
                  disabled={isSaving}
                  placeholder="Nombre completo"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange('telefono')}
                  disabled={isSaving}
                  placeholder="0000-0000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* Acceso al sistema */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Acceso al sistema
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Nombre de usuario
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">@</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={handleChange('username')}
                  disabled={isSaving}
                  placeholder="username"
                  className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* Error de API */}
          {apiError && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-xs text-red-600 font-medium">{apiError}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guardar cambios
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
