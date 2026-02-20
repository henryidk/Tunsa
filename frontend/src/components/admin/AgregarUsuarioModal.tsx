// AgregarUsuarioModal.tsx — modal para crear un nuevo usuario

import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Usuario } from '../../types/auth.types';
import { usuariosService } from '../../services/usuarios.service';
import PasswordGeneradaModal from './PasswordGeneradaModal';

interface AgregarUsuarioModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (nuevo: Usuario) => void;
}

const roles = [
  { value: 'admin',              label: 'Administrador' },
  { value: 'secretaria',         label: 'Secretaria' },
  { value: 'encargado_maquinas', label: 'Enc. de Máquinas' },
  { value: 'colaborador',        label: 'Colaborador' },
];

interface FormState {
  nombre: string;
  username: string;
  telefono: string;
  rol: string;
}

const emptyForm: FormState = {
  nombre: '',
  username: '',
  telefono: '',
  rol: '',
};

export default function AgregarUsuarioModal({ open, onClose, onCreated }: AgregarUsuarioModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  if (!open) return null;

  const handleChange = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setApiError(null);
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleClose = () => {
    if (isSaving) return;
    setForm(emptyForm);
    setApiError(null);
    onClose();
  };

  const handleSave = async () => {
    const nombre   = form.nombre.trim();
    const username = form.username.trim();
    const telefono = form.telefono.trim();
    const rol      = form.rol;

    if (!nombre)   { setApiError('El nombre es requerido.'); return; }
    if (!username) { setApiError('El nombre de usuario es requerido.'); return; }
    if (!rol)      { setApiError('Debes seleccionar un rol.'); return; }

    setIsSaving(true);
    setApiError(null);

    try {
      const resultado = await usuariosService.create({ nombre, username, telefono: telefono || undefined, rol });
      onCreated(resultado);
      setForm(emptyForm);
      setTemporaryPassword(resultado.temporaryPassword);
      // El modal de contraseña generada se muestra; onClose se llama cuando el admin cierra ese modal
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      setApiError(Array.isArray(msg) ? msg[0] : (msg ?? 'Ocurrió un error al crear el usuario.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Si ya tenemos la contraseña temporal, mostrar el modal de contraseña generada
  if (temporaryPassword) {
    return (
      <PasswordGeneradaModal
        password={temporaryPassword}
        onClose={() => {
          setTemporaryPassword(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Nuevo usuario</h2>
            <p className="text-xs text-slate-400 mt-0.5">Completa los datos para crear la cuenta</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
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
                  Nombre completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={handleChange('nombre')}
                  disabled={isSaving}
                  placeholder="Ej. Pedro García"
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Nombre de usuario <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">@</span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={handleChange('username')}
                    disabled={isSaving}
                    placeholder="usuario"
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Rol <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.rol}
                  onChange={handleChange('rol')}
                  disabled={isSaving}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-white"
                >
                  <option value="">Seleccionar rol...</option>
                  {roles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Info contraseña temporal */}
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs text-indigo-700">
              El sistema generará una contraseña temporal segura. El usuario deberá cambiarla en su primer inicio de sesión.
            </span>
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
            onClick={handleClose}
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
                Creando usuario...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                Crear usuario
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
