// EncargadoTopBar.tsx — topbar del encargado de máquinas

const sectionNames: Record<string, string> = {
  'dashboard':       'Dashboard',
  'nueva-solicitud': 'Nueva Solicitud',
  'pendientes':      'Pendientes de Aprobación',
  'rentas-activas':  'Rentas Activas',
  'vencidas':        'Rentas Vencidas',
  'historial':       'Historial',
  'equipos':         'Equipos',
};

interface Props {
  activeSection: string;
}

export default function EncargadoTopBar({ activeSection }: Props) {
  const currentName = sectionNames[activeSection] ?? 'Dashboard';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center px-6 gap-4 shadow-sm">
      <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <span className="text-slate-400 font-medium">Inicio</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-semibold truncate">{currentName}</span>
      </nav>

      <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
    </header>
  );
}
