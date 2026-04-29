import { useEffect, useState } from 'react';
import { useSolicitudesStore } from '../../../store/solicitudes.store';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onNavTo:     (section: string) => void;
  onShowToast: (type: ToastType, title: string, msg: string) => void;
  onOpenModal: (rentaId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tiempoAtras(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

function diasDesdeVencimiento(fechaStr: string): number {
  return Math.floor((Date.now() - new Date(fechaStr).getTime()) / 86_400_000);
}

function diasRestantes(fechaStr: string): number {
  return Math.ceil((new Date(fechaStr).getTime() - Date.now()) / 86_400_000);
}

function fechaCorta(dateStr: string): { dia: string; mes: string } {
  const d = new Date(dateStr);
  return {
    dia: String(d.getDate()).padStart(2, '0'),
    mes: d.toLocaleDateString('es-GT', { month: 'short' }).toUpperCase(),
  };
}

function hoyStr(): string {
  return new Date().toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── KPI card grande ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, isLoading, color, icon, onClick,
}: {
  label: string; value: number; sub?: string;
  isLoading: boolean; color: 'amber' | 'emerald' | 'red';
  icon: React.ReactNode; onClick?: () => void;
}) {
  const styles = {
    amber:   { bg: '#fef3c7', fg: '#d97706' },
    emerald: { bg: '#dcfce7', fg: '#16a34a' },
    red:     { bg: '#fee2e2', fg: '#dc2626' },
  }[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: styles.bg, color: styles.fg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        {isLoading ? (
          <div className="h-8 w-12 bg-slate-100 rounded animate-pulse mt-1" />
        ) : (
          <div className="text-3xl font-bold text-slate-800 leading-tight">{value}</div>
        )}
        {sub && !isLoading && (
          <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Stat financiero compacto ──────────────────────────────────────────────────

function FinancialCard({
  label, value, isLoading, icon, iconBg, iconFg,
}: {
  label: string; value: string; isLoading: boolean;
  icon: React.ReactNode; iconBg: string; iconFg: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, color: iconFg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        {isLoading ? (
          <div className="h-5 w-24 bg-slate-100 rounded animate-pulse mt-1" />
        ) : (
          <div className="text-base font-bold text-slate-800 font-mono leading-tight truncate">{value}</div>
        )}
      </div>
    </div>
  );
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({
  title, badge, action, children,
}: {
  title: string; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-sm">{title}</span>
          {badge}
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function CountBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      {count}
    </span>
  );
}

function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
      {label} →
    </button>
  );
}

// ── Panel: Actividad reciente ─────────────────────────────────────────────────

const ESTADO_DOT: Record<SolicitudRenta['estado'], string> = {
  PENDIENTE: 'bg-amber-400',
  APROBADA:  'bg-emerald-500',
  ACTIVA:    'bg-indigo-500',
  DEVUELTA:  'bg-slate-400',
  RECHAZADA: 'bg-red-500',
};
const ESTADO_BADGE: Record<SolicitudRenta['estado'], string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  APROBADA:  'bg-emerald-100 text-emerald-700',
  ACTIVA:    'bg-indigo-100 text-indigo-700',
  DEVUELTA:  'bg-slate-100 text-slate-600',
  RECHAZADA: 'bg-red-100 text-red-700',
};
const ESTADO_LABEL: Record<SolicitudRenta['estado'], string> = {
  PENDIENTE: 'Pendiente',
  APROBADA:  'Aprobada',
  ACTIVA:    'Activa',
  DEVUELTA:  'Devuelta',
  RECHAZADA: 'Rechazada',
};

function ActividadItem({ s }: { s: SolicitudRenta }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${ESTADO_DOT[s.estado]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{s.cliente.nombre}</span>
          {s.folio && <span className="text-[11px] font-mono text-slate-400">{s.folio}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
          {s.esPesada && <span className="ml-1.5 text-amber-600 font-medium">· Pesada</span>}
          <span className="text-slate-400 ml-1.5">· {s.creadaPor}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[s.estado]}`}>
          {ESTADO_LABEL[s.estado]}
        </span>
        <span className="text-[11px] text-slate-400">{tiempoAtras(s.createdAt)}</span>
      </div>
    </div>
  );
}

// ── Panel: Próximos vencimientos ──────────────────────────────────────────────

function VencimientoItem({ s }: { s: SolicitudRenta }) {
  const dias  = diasRestantes(s.fechaFinEstimada!);
  const fecha = fechaCorta(s.fechaFinEstimada!);
  const esUrgente = dias <= 1;
  const esAviso   = dias <= 3;

  const badgeCls   = esUrgente ? 'bg-red-100 text-red-700' : esAviso ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  const badgeLabel = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias} días`;

  return (
    <div className={`flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0 transition-colors ${
      esUrgente ? 'bg-red-50 hover:bg-red-100' : esAviso ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
    }`}>
      <div className={`text-center flex-shrink-0 border rounded-lg px-2 py-1 min-w-[38px] ${
        esUrgente ? 'bg-red-100 border-red-200' : 'bg-white border-slate-200'
      }`}>
        <div className="text-sm font-bold text-slate-800 leading-tight">{fecha.dia}</div>
        <div className="text-[9px] font-bold text-slate-500 tracking-wide">{fecha.mes}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{s.cliente.nombre}</div>
        <div className="text-xs text-slate-500 truncate">
          {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
          <span className="text-slate-400 ml-1">· {s.creadaPor}</span>
        </div>
      </div>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeCls}`}>
        {badgeLabel}
      </span>
    </div>
  );
}

// ── Panel: Vencidas urgentes ──────────────────────────────────────────────────

function VencidaItem({ s }: { s: SolicitudRenta }) {
  const dias = diasDesdeVencimiento(s.fechaFinEstimada!);

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-red-50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{s.cliente.nombre}</div>
        <div className="text-xs text-slate-500 truncate">
          {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
          <span className="text-slate-400 ml-1">· {s.creadaPor}</span>
        </div>
      </div>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0 whitespace-nowrap">
        {dias === 0 ? 'Hoy' : `${dias} día${dias !== 1 ? 's' : ''}`}
      </span>
    </div>
  );
}

// ── Skeleton y empty ──────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyPanel({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-xs text-center max-w-[180px] leading-relaxed">{mensaje}</p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardSection({ onNavTo }: Props) {
  const solicitudes  = useSolicitudesStore(s => s.solicitudes);
  const loadingStore = useSolicitudesStore(s => s.isLoading);

  const [activas,        setActivas]        = useState<SolicitudRenta[]>([]);
  const [vencidas,       setVencidas]       = useState<SolicitudRenta[]>([]);
  const [loadingActivas, setLoadingActivas] = useState(true);

  useEffect(() => {
    Promise.all([
      solicitudesService.getActivas(),
      solicitudesService.getVencidas(),
    ])
      .then(([a, v]) => { setActivas(a); setVencidas(v); })
      .finally(() => setLoadingActivas(false));
  }, []);

  // KPIs
  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE').length;

  // Financieros — calculados desde activas
  const ingresosLiviana  = activas.filter(s => !s.esPesada).reduce((sum, s) => sum + s.totalEstimado, 0);
  const acumuladoPesadas = activas.filter(s =>  s.esPesada).reduce((sum, s) => sum + s.costoAcumuladoPesada, 0);
  const equiposEnCampo   = activas.reduce((sum, s) => sum + s.items.length, 0);

  // Paneles
  const recientes = [...solicitudes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const proximosVencimientos = [...activas]
    .filter(s => s.fechaFinEstimada != null)
    .sort((a, b) => new Date(a.fechaFinEstimada!).getTime() - new Date(b.fechaFinEstimada!).getTime())
    .slice(0, 4);

  const vencidasUrgentes = [...vencidas]
    .sort((a, b) => new Date(a.fechaFinEstimada!).getTime() - new Date(b.fechaFinEstimada!).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1 capitalize">{hoyStr()}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Solicitudes pendientes"
          value={pendientes}
          sub={pendientes === 0 ? 'Sin pendientes' : pendientes === 1 ? 'Requiere revisión' : 'Requieren revisión'}
          isLoading={loadingStore}
          color="amber"
          onClick={() => onNavTo('rentas-solicitudes')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        <KpiCard
          label="Rentas activas"
          value={activas.length}
          sub={`${equiposEnCampo} equipo${equiposEnCampo !== 1 ? 's' : ''} en campo`}
          isLoading={loadingActivas}
          color="emerald"
          onClick={() => onNavTo('rentas-activas')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          }
        />
        <KpiCard
          label="Rentas vencidas"
          value={vencidas.length}
          sub={vencidas.length === 0 ? 'Todo al día' : 'Requieren atención'}
          isLoading={loadingActivas}
          color="red"
          onClick={() => onNavTo('rentas-vencidas')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
      </div>

      {/* Stats financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FinancialCard
          label="Ingresos proyectados (liviana)"
          value={fmtQ(ingresosLiviana)}
          isLoading={loadingActivas}
          iconBg="#f0fdf4" iconFg="#16a34a"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
        />
        <FinancialCard
          label="Cobrado por horómetro"
          value={fmtQ(acumuladoPesadas)}
          isLoading={loadingActivas}
          iconBg="#fef3c7" iconFg="#d97706"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        <FinancialCard
          label="Equipos en campo"
          value={String(equiposEnCampo)}
          isLoading={loadingActivas}
          iconBg="#eff6ff" iconFg="#3b82f6"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          }
        />
      </div>

      {/* Paneles */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Actividad reciente */}
        <Panel
          title="Actividad reciente"
          badge={<CountBadge count={solicitudes.length} color="bg-slate-100 text-slate-600" />}
          action={<NavLink label="Ver todas" onClick={() => onNavTo('rentas-solicitudes')} />}
        >
          {loadingStore ? <PanelSkeleton /> : recientes.length === 0
            ? <EmptyPanel mensaje="No hay solicitudes registradas." />
            : recientes.map(s => <ActividadItem key={s.id} s={s} />)
          }
        </Panel>

        {/* Próximos vencimientos */}
        <Panel
          title="Próximos vencimientos"
          badge={<CountBadge count={proximosVencimientos.length} color="bg-amber-100 text-amber-700" />}
          action={proximosVencimientos.length > 0
            ? <NavLink label="Ver activas" onClick={() => onNavTo('rentas-activas')} />
            : undefined
          }
        >
          {loadingActivas ? <PanelSkeleton /> : proximosVencimientos.length === 0
            ? <EmptyPanel mensaje="No hay vencimientos próximos." />
            : proximosVencimientos.map(s => <VencimientoItem key={s.id} s={s} />)
          }
        </Panel>

        {/* Vencidas urgentes */}
        <Panel
          title="Vencidas sin resolver"
          badge={<CountBadge count={vencidasUrgentes.length} color="bg-red-100 text-red-700" />}
          action={vencidasUrgentes.length > 0
            ? <NavLink label="Ver vencidas" onClick={() => onNavTo('rentas-vencidas')} />
            : undefined
          }
        >
          {loadingActivas ? <PanelSkeleton /> : vencidasUrgentes.length === 0
            ? <EmptyPanel mensaje="No hay rentas vencidas. ¡Todo al día!" />
            : vencidasUrgentes.map(s => <VencidaItem key={s.id} s={s} />)
          }
        </Panel>

      </div>
    </div>
  );
}
