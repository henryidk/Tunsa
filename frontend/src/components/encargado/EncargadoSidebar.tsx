// EncargadoSidebar.tsx — sidebar del encargado de máquinas

import type { ReactNode } from 'react';
import type { Usuario } from '../../types/auth.types';
import { useAprobadasStore } from '../../store/aprobadas.store';
import { useActivasStore } from '../../store/activas.store';

interface NavItem {
  id: string;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'danger';
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface Props {
  activeSection: string;
  onNavTo: (section: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  user: Usuario | null;
}

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const navGroups: NavGroup[] = [
  {
    title: 'PRINCIPAL',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'RENTAS',
    items: [
      {
        id: 'nueva-solicitud',
        label: 'Nueva Sol. Liviana',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ),
      },
      {
        id: 'nueva-solicitud-pesada',
        label: 'Nueva Sol. Pesada',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        ),
      },
      {
        id: 'mis-solicitudes',
        label: 'Mis Solicitudes',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        ),
      },
      {
        id: 'por-entregar',
        label: 'Por Entregar',
        badgeVariant: 'warning',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
          </svg>
        ),
      },
      {
        id: 'rentas-activas',
        label: 'Activas',
        badgeVariant: 'success',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      },
      {
        id: 'horometros',
        label: 'Horómetros',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      },
      {
        id: 'vencidas',
        label: 'Vencidas',
        badgeVariant: 'danger',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
      {
        id: 'historial',
        label: 'Historial',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'GESTIÓN',
    items: [
      {
        id: 'equipos',
        label: 'Equipos',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        ),
      },
      {
        id: 'clientes',
        label: 'Clientes',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
    ],
  },
];

const badgeCls: Record<string, string> = {
  default: 'bg-amber-100 text-amber-700',
  success: 'bg-green-100 text-green-700',
  danger:  'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
};

export default function EncargadoSidebar({ activeSection, onNavTo, collapsed, onToggle, onLogout, user }: Props) {
  const nombre = user?.nombre ?? '';
  const porEntregarCount = useAprobadasStore(s => s.solicitudes.length);

  const activasSolicitudes = useActivasStore(s => s.solicitudes);
  const hoyStr = new Date().toISOString().substring(0, 10);
  const horometrosPendientes = activasSolicitudes.filter(s => {
    if (!s.esPesada) return false;
    const ul = s.ultimaLectura;
    return !ul || ul.fecha !== hoyStr || !ul.completa;
  }).length;

  const initials = nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col bg-white border-r border-slate-200 shadow-sm z-50 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center h-14 px-3 border-b border-slate-200 gap-2 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="flex-shrink-0 text-amber-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="font-bold text-slate-800 text-sm truncate">Sistema Ferretería</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0 ml-auto"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* Usuario */}
      <div className={`flex items-center border-b border-slate-200 flex-shrink-0 ${collapsed ? 'justify-center py-3' : 'gap-3 px-4 py-3'}`}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{nombre}</div>
            <div className="text-xs text-slate-500">Enc. de Máquinas</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map(group => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-bold text-slate-400 tracking-widest">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavTo(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-amber-600' : ''}`}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.id === 'por-entregar' && porEntregarCount > 0 && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeCls['warning']}`}>
                            {porEntregarCount}
                          </span>
                        )}
                        {item.id === 'horometros' && horometrosPendientes > 0 && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeCls['danger']}`}>
                            {horometrosPendientes}
                          </span>
                        )}
                        {item.id !== 'por-entregar' && item.id !== 'horometros' && item.badge && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeCls[item.badgeVariant ?? 'default']}`}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-2 flex-shrink-0">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogoutIcon />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
