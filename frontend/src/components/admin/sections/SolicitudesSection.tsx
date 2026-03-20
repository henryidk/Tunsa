// SolicitudesSection.tsx — revisión y aprobación de solicitudes

import { useState } from 'react'

import type { ToastType } from '../../../pages/admin/AdminDashboard'

interface SolicitudesSectionProps {
  onShowToast: (type: ToastType, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const Avatar = ({ initials, gradient }: { initials: string; gradient?: string }) => (
  <div
    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
    style={{ background: gradient ?? 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
  >
    {initials}
  </div>
)

const EquipTag = ({ label }: { label: string }) => (
  <span className="text-[11.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
    {label}
  </span>
)

type TabId = 'todas' | 'pendientes' | 'aprobadas' | 'rechazadas'

export default function SolicitudesSection({ onShowToast, onOpenModal }: SolicitudesSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('todas')

  const tabs: { id: TabId; label: string; count: string; countCls: string }[] = [
    { id: 'todas', label: 'Todas', count: '12', countCls: 'bg-slate-200 text-slate-600' },
    { id: 'pendientes', label: 'Pendientes', count: '5', countCls: 'bg-amber-100 text-amber-700' },
    { id: 'aprobadas', label: 'Aprobadas', count: '6', countCls: 'bg-green-100 text-green-700' },
    { id: 'rechazadas', label: 'Rechazadas', count: '1', countCls: 'bg-red-100 text-red-700' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitudes de Renta</h1>
          <p className="text-sm text-slate-500 mt-1">Revisión y aprobación de solicitudes de los encargados</p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Buscar por ID, cliente o equipo..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[220px]"
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Todos los estados</option>
          <option>Pendiente</option>
          <option>Aprobada</option>
          <option>Rechazada</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Este mes</option>
          <option>Semana actual</option>
          <option>Mes pasado</option>
        </select>
        {/* Filter tabs */}
        <div className="ml-auto flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-r border-slate-200 last:border-0 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab.countCls}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['ID Solicitud', 'Cliente', 'Equipos', 'Fecha inicio', 'Duración', 'Total estimado', 'Estado', 'Solicitado por', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Row 1 - Pendiente */}
              <tr className="bg-amber-50 border-b border-slate-100 hover:bg-amber-100 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-800 font-mono">RNT-2024-089</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials="JC" />
                    <div>
                      <div className="font-semibold text-slate-800">Juan Choc</div>
                      <div className="text-xs text-slate-500">CLI-0042</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <EquipTag label="Compresor de Aire" /><EquipTag label="Martillo Neumático" /><EquipTag label="+1" />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">19 Feb 2026</td>
                <td className="px-4 py-3 text-slate-700">5 días</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q2,900</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pendiente</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">Juan Pérez</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => onShowToast('success', 'Aprobada', 'Solicitud RNT-2024-089 aprobada')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Aprobar</button>
                    <button onClick={() => onShowToast('error', 'Rechazada', 'Solicitud rechazada')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">Rechazar</button>
                    <button onClick={() => onOpenModal('RNT-2024-089')} className="p-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"><EyeIcon /></button>
                  </div>
                </td>
              </tr>
              {/* Row 2 - Pendiente */}
              <tr className="bg-amber-50 border-b border-slate-100 hover:bg-amber-100 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-800 font-mono">RNT-2024-087</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials="CT" />
                    <div>
                      <div className="font-semibold text-slate-800">Carlos Tun</div>
                      <div className="text-xs text-slate-500">CLI-0031</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Cortadora de Concreto" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">22 Feb 2026</td>
                <td className="px-4 py-3 text-slate-700">5 días</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q1,250</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pendiente</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">Juan Pérez</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => onShowToast('success', 'Aprobada', 'Solicitud aprobada')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">Aprobar</button>
                    <button onClick={() => onShowToast('error', 'Rechazada', 'Solicitud rechazada')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">Rechazar</button>
                    <button onClick={() => onOpenModal('RNT-2024-087')} className="p-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"><EyeIcon /></button>
                  </div>
                </td>
              </tr>
              {/* Row 3 - Aprobada */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-800 font-mono">RNT-2024-088</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials="MG" />
                    <div>
                      <div className="font-semibold text-slate-800">María González</div>
                      <div className="text-xs text-slate-500">CLI-0028</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Taladro Industrial" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">15 Feb 2026</td>
                <td className="px-4 py-3 text-slate-700">3 días</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q450</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Aprobada</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">Ana López</td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpenModal('RNT-2024-088')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"><EyeIcon /> Ver detalle</button>
                </td>
              </tr>
              {/* Row 4 - Vencida */}
              <tr className="bg-red-50 border-b border-slate-100 hover:bg-red-100 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-800 font-mono">RNT-2024-081</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar initials="RA" />
                    <div>
                      <div className="font-semibold text-slate-800">Roberto Ajú</div>
                      <div className="text-xs text-slate-500">CLI-0019</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Mezcladora de Concreto" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">10 Feb 2026</td>
                <td className="px-4 py-3 text-slate-700">7 días</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q1,540</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Vencida</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">Juan Pérez</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => onShowToast('warning', 'Notificado', 'Aviso enviado al cliente')} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">Notificar</button>
                    <button onClick={() => onOpenModal('RNT-2024-081')} className="p-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"><EyeIcon /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-sm text-slate-500">Mostrando 1–4 de 12 solicitudes</span>
          <div className="flex items-center gap-1">
            {['←', '1', '2', '3', '→'].map((p, i) => (
              <button
                key={p + i}
                disabled={p === '←'}
                className={`min-w-[32px] h-8 px-2 text-sm font-semibold rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  p === '1'
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
