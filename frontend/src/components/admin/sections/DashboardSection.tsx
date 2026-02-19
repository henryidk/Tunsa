// DashboardSection.tsx — resumen general del sistema

interface DashboardSectionProps {
  onNavTo: (section: string) => void
  onShowToast: (icon: string, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  colorCls,
  iconBg,
  iconColor,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend: string
  trendUp: boolean
  colorCls: string
  iconBg: string
  iconColor: string
  mono?: boolean
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm ${colorCls}`}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={`text-3xl font-bold text-slate-800 leading-tight ${mono ? 'font-mono !text-2xl' : ''}`}>{value}</div>
        <div className={`text-xs font-medium mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>{trend}</div>
      </div>
    </div>
  )
}

function MiniStat({ icon, value, label, iconBg, iconColor }: {
  icon: React.ReactNode; value: string; label: string; iconBg: string; iconColor: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:-translate-y-1 transition-transform">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800 font-mono leading-tight">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

type ActivityStatus = 'pending' | 'approved' | 'active' | 'overdue'

const dotColor: Record<ActivityStatus, string> = {
  pending: 'bg-amber-400',
  approved: 'bg-green-500',
  active: 'bg-indigo-500',
  overdue: 'bg-red-500',
}

const badgeCls: Record<ActivityStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  active: 'bg-indigo-100 text-indigo-700',
  overdue: 'bg-red-100 text-red-700',
}

const badgeLabel: Record<ActivityStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  active: 'Activa',
  overdue: 'Vencida',
}

function ActivityItem({ id, name, equipos, status, time }: {
  id: string; name: string; equipos: string; status: ActivityStatus; time: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[status]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 truncate">
          {name} — <strong>{id}</strong>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{equipos}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls[status]}`}>
          {badgeLabel[status]}
        </span>
        <span className="text-[11px] text-slate-400">{time}</span>
      </div>
    </div>
  )
}

type VencUrgency = 'urgent' | 'warn' | 'normal' | 'ok'

const vencBadge: Record<VencUrgency, { cls: string; label: string }> = {
  urgent: { cls: 'bg-red-100 text-red-700', label: 'Mañana' },
  warn: { cls: 'bg-amber-100 text-amber-700', label: '3 días' },
  normal: { cls: 'bg-green-100 text-green-700', label: '6 días' },
  ok: { cls: 'bg-indigo-100 text-indigo-700', label: '10 días' },
}

function VencItem({ day, month, client, equipo, rentaId, urgency }: {
  day: string; month: string; client: string; equipo: string; rentaId: string; urgency: VencUrgency
}) {
  const isUrgent = urgency === 'urgent'
  const isWarn = urgency === 'warn'
  return (
    <div
      className={`flex items-center gap-3.5 px-5 py-3.5 border-b border-slate-100 last:border-0 transition-colors ${
        isUrgent ? 'bg-red-50 hover:bg-red-100' : isWarn ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
      }`}
    >
      <div
        className={`text-center flex-shrink-0 border rounded-lg px-2.5 py-1.5 min-w-[44px] ${
          isUrgent ? 'bg-red-100 border-red-200' : 'bg-white border-slate-200'
        }`}
      >
        <div className="text-lg font-bold text-slate-800 leading-tight">{day}</div>
        <div className="text-[10px] font-bold text-slate-500 tracking-wide">{month}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{client}</div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">{equipo}</div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rentaId}</div>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${vencBadge[urgency].cls}`}>
        {vencBadge[urgency].label}
      </span>
    </div>
  )
}

export default function DashboardSection({ onNavTo }: DashboardSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Resumen general del sistema · Hoy, 19 de febrero 2026</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Febrero 2026
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar reporte
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          label="Solicitudes pendientes" value="5" trend="+2 desde ayer" trendUp colorCls=""
          iconBg="#fef3c7" iconColor="#d97706"
        />
        <StatCard
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
          label="Rentas activas" value="8" trend="+1 esta semana" trendUp colorCls=""
          iconBg="#dcfce7" iconColor="#16a34a"
        />
        <StatCard
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          label="Rentas vencidas" value="2" trend="Requieren atención" trendUp={false} colorCls=""
          iconBg="#fee2e2" iconColor="#dc2626"
        />
        <StatCard
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          label="Ingresos del mes" value="Q14,820" trend="+12% vs mes anterior" trendUp colorCls=""
          iconBg="#e0e7ff" iconColor="#4f46e5" mono
        />
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MiniStat value="23" label="Equipos en catálogo"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
          iconBg="#f0f9ff" iconColor="#0369a1" />
        <MiniStat value="18" label="Equipos disponibles"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          iconBg="#f0fdf4" iconColor="#15803d" />
        <MiniStat value="5" label="Equipos en renta"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          iconBg="#fff7ed" iconColor="#c2410c" />
        <MiniStat value="142" label="Clientes registrados"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
          iconBg="#faf5ff" iconColor="#7c3aed" />
        <MiniStat value="6" label="Usuarios del sistema"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          iconBg="#f0f9ff" iconColor="#0369a1" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Actividad reciente */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="font-bold text-slate-800">Actividad reciente</span>
            <button
              onClick={() => onNavTo('rentas-solicitudes')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Ver todas →
            </button>
          </div>
          <div>
            <ActivityItem id="RNT-2024-089" name="Juan Choc" equipos="Compresor · Martillo · Andamio" status="pending" time="Hace 15 min" />
            <ActivityItem id="RNT-2024-088" name="María González" equipos="Taladro Industrial · 3 días" status="approved" time="Hace 1 h" />
            <ActivityItem id="RNT-2024-081" name="Roberto Ajú" equipos="Mezcladora · Vencida hace 2 días" status="overdue" time="14 Feb" />
            <ActivityItem id="RNT-2024-085" name="Ferretería El Progreso" equipos="Generador · Sierra Circular · 7 días" status="active" time="12 Feb" />
            <ActivityItem id="RNT-2024-087" name="Carlos Tun" equipos="Cortadora de Concreto · 5 días" status="pending" time="Hace 3 h" />
          </div>
        </div>

        {/* Próximos vencimientos */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="font-bold text-slate-800">Próximos vencimientos</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
              2 esta semana
            </span>
          </div>
          <div>
            <VencItem day="20" month="FEB" client="Carlos Tun Chub" equipo="Taladro Industrial (x2) · Q450/día" rentaId="RNT-2024-083" urgency="urgent" />
            <VencItem day="22" month="FEB" client="Ferretería El Progreso" equipo="Generador Eléctrico · Q300/día" rentaId="RNT-2024-085" urgency="warn" />
            <VencItem day="25" month="FEB" client="María González Xol" equipo="Compresor de Aire · Q200/día" rentaId="RNT-2024-088" urgency="normal" />
            <VencItem day="01" month="MAR" client="Construcciones Ajú S.A." equipo="Andamio Metálico (x4) · Mezcladora" rentaId="RNT-2024-086" urgency="ok" />
          </div>
        </div>
      </div>
    </div>
  )
}
