// TopBar.tsx — header con breadcrumb y KPIs rápidos

const sectionNames: Record<string, string> = {
  dashboard: 'Dashboard',
  'rentas-solicitudes': 'Solicitudes',
  'rentas-activas': 'Rentas Activas',
  'rentas-historial': 'Historial',
  'rentas-vencidas': 'Vencidas',
  equipos: 'Equipos',
  clientes: 'Clientes',
  usuarios: 'Usuarios del sistema',
}

interface TopBarProps {
  activeSection: string
}

export default function TopBar({ activeSection }: TopBarProps) {
  const currentName = sectionNames[activeSection] ?? 'Dashboard'

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
          <span className="text-sm font-bold text-slate-800 font-mono">3</span>
        </div>
        <div className="w-px h-9 bg-slate-200 flex-shrink-0" />
        <div className="flex flex-col items-start px-4 py-1.5">
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Ingresos mes</span>
          <span className="text-sm font-bold text-indigo-600 font-mono">Q 14,820</span>
        </div>
      </div>

      {/* Notification button */}
      <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
    </header>
  )
}
