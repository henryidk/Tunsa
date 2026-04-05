// RentasActivasSection.tsx — contratos de renta en curso

import type { ToastType } from '../../../types/ui.types'

interface RentasActivasSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

const Avatar = ({ initials }: { initials: string }) => (
  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
    {initials}
  </div>
)

const EquipTag = ({ label }: { label: string }) => (
  <span className="text-[11.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
    {label}
  </span>
)

function DaysBar({ pct, color, days }: { pct: number; color: string; days: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{days}</span>
    </div>
  )
}

export default function RentasActivasSection({ onOpenModal }: RentasActivasSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rentas Activas</h1>
          <p className="text-sm text-slate-500 mt-1">Contratos de renta en curso actualmente</p>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div><div className="text-sm font-medium text-slate-500">Contratos activos</div><div className="text-3xl font-bold text-slate-800">8</div></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>
          </div>
          <div><div className="text-sm font-medium text-slate-500">Equipos en campo</div><div className="text-3xl font-bold text-slate-800">14</div></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7', color: '#d97706' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div><div className="text-sm font-medium text-slate-500">Ingresos proyectados</div><div className="text-2xl font-bold font-mono text-slate-800">Q6,240</div></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">Contratos en curso</span>
          <input
            type="search"
            placeholder="Buscar..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[200px]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Contrato', 'Cliente', 'Equipos rentados', 'Inicio', 'Vence', 'Días restantes', 'Total', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* RNT-2024-088 */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-088</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="MG" /><span className="font-semibold text-slate-800">María González</span></div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Taladro Industrial" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">15 Feb</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">25 Feb</td>
                <td className="px-4 py-3"><DaysBar pct={40} color="#16a34a" days="6 días" /></td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q450</td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpenModal('RNT-2024-088')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver detalle</button>
                </td>
              </tr>
              {/* RNT-2024-085 */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-085</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="FP" /><span className="font-semibold text-slate-800">Ferretería El Progreso</span></div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Generador" /><EquipTag label="Sierra Circular" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">12 Feb</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">22 Feb</td>
                <td className="px-4 py-3"><DaysBar pct={75} color="#d97706" days="3 días" /></td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q3,220</td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpenModal('RNT-2024-085')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver detalle</button>
                </td>
              </tr>
              {/* RNT-2024-086 */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-086</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="CA" /><span className="font-semibold text-slate-800">Construcciones Ajú</span></div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Andamio x4" /><EquipTag label="Mezcladora" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">19 Feb</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">01 Mar</td>
                <td className="px-4 py-3"><DaysBar pct={10} color="#16a34a" days="10 días" /></td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q2,420</td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpenModal('RNT-2024-086')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver detalle</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
