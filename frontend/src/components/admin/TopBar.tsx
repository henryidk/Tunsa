// TopBar.tsx — header con breadcrumb, KPIs rápidos y panel de notificaciones

import { useEffect, useRef, useState } from 'react';
import NotificationPanel from './NotificationPanel';

const sectionNames: Record<string, string> = {
  dashboard:           'Dashboard',
  'rentas-solicitudes': 'Solicitudes',
  'rentas-activas':     'Rentas Activas',
  'rentas-historial':   'Historial',
  'rentas-vencidas':    'Vencidas',
  equipos:              'Equipos',
  clientes:             'Clientes',
  usuarios:             'Usuarios del sistema',
}

interface TopBarProps {
  activeSection: string;
  onNavTo:       (section: string) => void;
  unreadCount:   number;
  todayCount:    number;
}

export default function TopBar({ activeSection, onNavTo, unreadCount, todayCount }: TopBarProps) {
  const currentName = sectionNames[activeSection] ?? 'Dashboard';
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cierra el panel al hacer clic fuera de él.
  useEffect(() => {
    if (!panelOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [panelOpen]);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center px-6 gap-4 shadow-sm">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <span className="text-slate-400 font-medium">Inicio</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-semibold truncate">{currentName}</span>
      </nav>

      {/* Quick KPIs */}
      <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-col items-start px-4 py-1.5">
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Solicitudes hoy</span>
          <span className="text-sm font-bold text-slate-800 font-mono">{todayCount}</span>
        </div>
      </div>

      {/* Bell button + notification panel */}
      <div ref={wrapperRef} className="relative">
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`relative p-2 rounded-lg transition-colors ${
            panelOpen
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          aria-label="Notificaciones"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white leading-none">
              {badgeLabel}
            </span>
          )}
        </button>

        {panelOpen && (
          <NotificationPanel
            onNavTo={onNavTo}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>
    </header>
  )
}
