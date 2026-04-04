// DashboardSection.tsx — resumen general para el encargado de máquinas

interface Props {
  onNavTo: (section: string) => void;
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  section?: string;
}

export default function DashboardSection({ onNavTo }: Props) {
  const stats: StatCard[] = [
    {
      label: 'Pendientes de aprobación',
      value: '—',
      section: 'pendientes',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label: 'Rentas activas',
      value: '—',
      section: 'rentas-activas',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    },
    {
      label: 'Rentas vencidas',
      value: '—',
      section: 'vencidas',
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'Mis solicitudes este mes',
      value: '—',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Resumen general del sistema de rentas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div
            key={s.label}
            onClick={() => s.section && onNavTo(s.section)}
            className={`bg-white border border-slate-200 rounded-xl px-4 py-4 shadow-sm flex items-center gap-3.5 ${
              s.section ? 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-all' : ''
            }`}
          >
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700 text-sm">Actividad reciente</span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="text-sm">No hay actividad reciente</p>
        </div>
      </div>
    </div>
  );
}
