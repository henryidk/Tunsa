import type { ReactNode } from 'react';

export type StatCardColor = 'indigo' | 'amber' | 'emerald' | 'red' | 'orange';

const COLOR_MAP: Record<StatCardColor, { bg: string; icon: string; value: string }> = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  value: 'text-indigo-700'  },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   value: 'text-amber-700'   },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', value: 'text-emerald-700' },
  red:     { bg: 'bg-red-50',     icon: 'text-red-500',     value: 'text-red-700'     },
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-500',  value: 'text-orange-700'  },
};

interface StatCardProps {
  label: string;
  value: string | null;
  icon:  ReactNode;
  color: StatCardColor;
  tag?:  string;
}

export default function StatCard({ label, value, icon, color, tag }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        {value === null ? (
          <div className="mt-1 h-6 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className={`text-xl font-bold font-mono ${c.value}`}>{value}</p>
        )}
        {tag && (
          <p className="text-[10px] font-medium mt-0.5 text-slate-400">{tag}</p>
        )}
      </div>
    </div>
  );
}
