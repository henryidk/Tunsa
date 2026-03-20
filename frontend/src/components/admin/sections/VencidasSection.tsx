// VencidasSection.tsx — equipos no devueltos en fecha acordada

import type { ToastType } from '../../../pages/admin/AdminDashboard'

interface VencidasSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

const EquipTag = ({ label }: { label: string }) => (
  <span className="text-[11.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
    {label}
  </span>
)

export default function VencidasSection({ onShowToast, onOpenModal }: VencidasSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rentas Vencidas</h1>
          <p className="text-sm text-slate-500 mt-1">Equipos que no han sido devueltos en la fecha acordada</p>
        </div>
      </div>

      {/* Alert banner */}
      <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3.5 mb-5 text-sm text-red-800">
        <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span><strong>2 rentas vencidas</strong> — Equipos sin devolver. Contacta a los clientes o aplica recargos según política.</span>
        <button
          onClick={() => onShowToast('info', 'Notificaciones enviadas', 'Se notificó a todos los clientes con rentas vencidas')}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors flex-shrink-0"
        >
          Notificar a todos
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Contrato', 'Cliente', 'Equipo(s)', 'Venció el', 'Días vencida', 'Recargo estimado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* RNT-2024-081 */}
              <tr className="bg-red-50 border-b border-slate-100 hover:bg-red-100 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-081</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#fee2e2', color: '#991b1b' }}>RA</div>
                    <div>
                      <div className="font-semibold text-slate-800">Roberto Ajú Tum</div>
                      <div className="text-xs text-slate-500 font-mono">3333-9012</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Mezcladora de Concreto" /></div></td>
                <td className="px-4 py-3 font-semibold text-red-600 whitespace-nowrap">17 Feb 2026</td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-red-600 bg-red-100 px-3 py-0.5 rounded-full">+2 días</span>
                </td>
                <td className="px-4 py-3 font-bold font-mono text-red-600">Q440</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => onShowToast('info', 'Notificado', 'Aviso enviado')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">Notificar</button>
                    <button onClick={() => onShowToast('success', 'Marcado', 'Equipo devuelto')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Devuelto</button>
                    <button onClick={() => onOpenModal('RNT-2024-081')} className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver</button>
                  </div>
                </td>
              </tr>
              {/* RNT-2024-074 */}
              <tr className="bg-red-50 border-b border-slate-100 hover:bg-red-100 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-074</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#fee2e2', color: '#991b1b' }}>LC</div>
                    <div>
                      <div className="font-semibold text-slate-800">Luis Cucul Pop</div>
                      <div className="text-xs text-slate-500 font-mono">4444-1122</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Sierra Circular" /><EquipTag label="Taladro Industrial" /></div></td>
                <td className="px-4 py-3 font-semibold text-red-600 whitespace-nowrap">14 Feb 2026</td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-red-600 bg-red-100 px-3 py-0.5 rounded-full">+5 días</span>
                </td>
                <td className="px-4 py-3 font-bold font-mono text-red-600">Q1,550</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => onShowToast('info', 'Notificado', 'Aviso enviado')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">Notificar</button>
                    <button onClick={() => onShowToast('success', 'Marcado', 'Equipo devuelto')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Devuelto</button>
                    <button className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
