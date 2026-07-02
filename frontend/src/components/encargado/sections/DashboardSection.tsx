import { useDashboardStats } from '../../../hooks/useDashboardStats';

interface Props {
  onNavTo: (section: string) => void;
}

export default function DashboardSection({ onNavTo }: Props) {
  const { stats, loading } = useDashboardStats();

  const cards = [
    {
      label:   'Pendientes de aprobación',
      value:   stats?.pendientes,
      section: 'mis-solicitudes',
      color:   'text-amber-600',
      bg:      'bg-amber-50',
      ring:    'ring-amber-200',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label:   'Rentas activas',
      value:   stats?.activas,
      section: 'rentas-activas',
      color:   'text-emerald-600',
      bg:      'bg-emerald-50',
      ring:    'ring-emerald-200',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    },
    {
      label:   'Rentas vencidas',
      value:   stats?.vencidas,
      section: 'vencidas',
      color:   'text-red-600',
      bg:      'bg-red-50',
      ring:    'ring-red-200',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      label:   'Mis solicitudes este mes',
      value:   stats?.solicitudesEsteMes,
      section: 'mis-solicitudes',
      color:   'text-brand-700',
      bg:      'bg-brand-50',
      ring:    'ring-brand-200',
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Resumen de tu actividad</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <button
            key={card.label}
            onClick={() => onNavTo(card.section)}
            className="bg-white rounded-2xl px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] flex items-center gap-3.5 text-left w-full cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
          >
            <div className={`w-11 h-11 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0 ${card.color}`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              {loading ? (
                <div className="h-7 w-10 bg-slate-200 rounded animate-pulse mb-1" />
              ) : (
                <div className={`text-2xl font-bold font-mono ${card.color}`}>
                  {card.value ?? 0}
                </div>
              )}
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">{card.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Actividad reciente — pendiente de implementar */}
      <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
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
