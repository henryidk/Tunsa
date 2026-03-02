// UsuariosSection.tsx — usuarios del sistema, roles y permisos

import { useState } from 'react';
import type { Usuario } from '../../../types/auth.types';
import { useUsuarios } from '../../../hooks/useUsuarios';
import { usuariosService } from '../../../services/usuarios.service';
import EditarUsuarioModal from '../EditarUsuarioModal';
import ConfirmDesactivarModal from '../ConfirmDesactivarModal';
import AgregarUsuarioModal from '../AgregarUsuarioModal';
import ResetPasswordModal from '../ResetPasswordModal';

interface UsuariosSectionProps {
  onShowToast: (icon: string, title: string, msg: string) => void;
  user: Usuario | null;
}

const rolBadge: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800',
  encargado_maquinas: 'bg-indigo-100 text-indigo-700',
  secretaria: 'bg-sky-100 text-sky-700',
  colaborador: 'bg-green-100 text-green-700',
};

const rolLabel: Record<string, string> = {
  admin: 'Administrador',
  secretaria: 'Secretaria',
  encargado_maquinas: 'Enc. Máquinas',
  colaborador: 'Colaborador',
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

export default function UsuariosSection({ onShowToast, user }: UsuariosSectionProps) {
  const { usuarios, isLoading, error, addUsuario, updateUsuario } = useUsuarios();
  const [agregarOpen, setAgregarOpen] = useState(false);
  const [editUsuario, setEditUsuario] = useState<Usuario | null>(null);
  const [desactivarUsuario, setDesactivarUsuario] = useState<Usuario | null>(null);
  const [activandoId, setActivandoId] = useState<string | null>(null);
  const [resetUsuario, setResetUsuario] = useState<Usuario | null>(null);

  const handleActivar = async (u: Usuario) => {
    setActivandoId(u.id);
    try {
      const updated = await usuariosService.activate(u.id);
      updateUsuario(updated);
      onShowToast('✅', 'Usuario activado', `${u.nombre} puede iniciar sesión nuevamente`);
    } catch {
      onShowToast('❌', 'Error', 'No se pudo activar el usuario');
    } finally {
      setActivandoId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios del sistema</h1>
          <p className="text-sm text-slate-500 mt-1">Cuentas con acceso al sistema, roles y permisos</p>
        </div>
        <button
          onClick={() => setAgregarOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Agregar usuario
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Usuario', 'Rol', 'Teléfono', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    Cargando usuarios...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && usuarios.map(u => {
                const isCurrentUser = user?.username === u.username;
                const rolKey = u.role.nombre;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!u.isActive ? 'opacity-55' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: rolGradient[rolKey] ?? '#94a3b8' }}
                        >
                          {getInitials(u.nombre)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {u.nombre}
                            {isCurrentUser && u.isActive && (
                              <span className="text-[11px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">Tú</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">@{u.username}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{rolLabel[rolKey] ?? rolKey}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${rolBadge[rolKey] ?? 'bg-slate-100 text-slate-600'}`}>
                        {rolLabel[rolKey] ?? rolKey}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{u.telefono ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.isActive ? (
                          <>
                            <button
                              disabled={isCurrentUser}
                              onClick={() => setEditUsuario(u)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Editar
                            </button>
                            {!isCurrentUser && (
                              <>
                                <button
                                  onClick={() => setResetUsuario(u)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                                  title="Restablecer contraseña"
                                >
                                  Resetear
                                </button>
                                <button
                                  onClick={() => setDesactivarUsuario(u)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                                >
                                  Desactivar
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <button
                            disabled={activandoId === u.id}
                            onClick={() => handleActivar(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {activandoId === u.id ? (
                              <>
                                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                Activando...
                              </>
                            ) : 'Activar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles info */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">Roles del sistema</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { rolKey: 'admin', label: 'Administrador', desc: 'Acceso total: usuarios, equipos, clientes, rentas y reportes.' },
            { rolKey: 'secretaria', label: 'Secretaria', desc: 'Aprobación de solicitudes, gestión de cobros y reportes.' },
            { rolKey: 'encargado_maquinas', label: 'Enc. de Máquinas', desc: 'Creación de solicitudes y gestión de equipos en campo.' },
            { rolKey: 'colaborador', label: 'Colaborador', desc: 'Solo lectura: rentas activas e inventario de equipos.' },
          ].map(r => (
            <div key={r.rolKey} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
              <span className={`inline-flex items-center self-start px-2.5 py-1 rounded-full text-xs font-bold ${rolBadge[r.rolKey] ?? 'bg-slate-100 text-slate-600'}`}>
                {r.label}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <AgregarUsuarioModal
        open={agregarOpen}
        onClose={() => setAgregarOpen(false)}
        onCreated={nuevo => {
          addUsuario(nuevo);
          onShowToast('👤', 'Usuario creado', `${nuevo.nombre} fue agregado al sistema`);
        }}
      />

      <EditarUsuarioModal
        usuario={editUsuario}
        open={editUsuario !== null}
        onClose={() => setEditUsuario(null)}
        onSave={updated => { updateUsuario(updated); setEditUsuario(null); }}
      />

      <ConfirmDesactivarModal
        usuario={desactivarUsuario}
        open={desactivarUsuario !== null}
        onClose={() => setDesactivarUsuario(null)}
        onConfirm={updated => {
          updateUsuario(updated);
          setDesactivarUsuario(null);
          onShowToast('🔒', 'Usuario desactivado', `${updated.nombre} no podrá iniciar sesión`);
        }}
      />

      <ResetPasswordModal
        usuario={resetUsuario}
        open={resetUsuario !== null}
        onClose={() => setResetUsuario(null)}
      />
    </div>
  );
}
