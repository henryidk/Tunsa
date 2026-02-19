// EquiposSection.tsx — catálogo de maquinaria para renta

import { useState } from 'react'

interface EquiposSectionProps {
  onShowToast: (icon: string, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

type TabId = 'todos' | 'disponibles' | 'en-renta'

interface Equipo {
  emoji: string
  name: string
  category: string
  price: string
  stock: number
  rentals: number
  available: boolean
}

const equipos: Equipo[] = [
  { emoji: '🔩', name: 'Taladro Industrial', category: 'Perforación', price: 'Q150', stock: 3, rentals: 47, available: true },
  { emoji: '💨', name: 'Compresor de Aire', category: 'Compresión', price: 'Q200', stock: 2, rentals: 31, available: false },
  { emoji: '🔨', name: 'Martillo Neumático', category: 'Demolición', price: 'Q180', stock: 2, rentals: 22, available: true },
  { emoji: '⚡', name: 'Generador Eléctrico', category: 'Generación', price: 'Q300', stock: 1, rentals: 18, available: false },
  { emoji: '🏗️', name: 'Andamio Metálico', category: 'Elevación', price: 'Q100', stock: 8, rentals: 56, available: true },
  { emoji: '🌀', name: 'Mezcladora de Concreto', category: 'Mezcla', price: 'Q220', stock: 2, rentals: 29, available: false },
  { emoji: '🪚', name: 'Sierra Circular', category: 'Corte', price: 'Q160', stock: 3, rentals: 15, available: true },
  { emoji: '🎯', name: 'Niveladora Láser', category: 'Medición', price: 'Q120', stock: 2, rentals: 9, available: true },
]

export default function EquiposSection({ onShowToast }: EquiposSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('todos')

  const tabs: { id: TabId; label: string; count: string; countCls: string }[] = [
    { id: 'todos', label: 'Todos', count: '23', countCls: 'bg-slate-200 text-slate-600' },
    { id: 'disponibles', label: 'Disponibles', count: '18', countCls: 'bg-green-100 text-green-700' },
    { id: 'en-renta', label: 'En renta', count: '5', countCls: 'bg-amber-100 text-amber-700' },
  ]

  const filtered = equipos.filter(e => {
    if (activeTab === 'disponibles') return e.available
    if (activeTab === 'en-renta') return !e.available
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Equipos</h1>
          <p className="text-sm text-slate-500 mt-1">Catálogo completo de maquinaria disponible para renta</p>
        </div>
        <button
          onClick={() => onShowToast('🔧', 'Nuevo equipo', 'Disponible en la versión final del sistema')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar equipo
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Buscar equipo..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[200px]"
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Todas las categorías</option>
          <option>Perforación</option>
          <option>Compresión</option>
          <option>Corte</option>
          <option>Elevación</option>
          <option>Generación</option>
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

      {/* Equipment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(eq => (
          <div
            key={eq.name}
            className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-md transition-all"
          >
            <div className="px-4 pt-4 flex items-start justify-between">
              <span className="text-4xl">{eq.emoji}</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  eq.available ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {eq.available ? 'Disponible' : 'En renta'}
              </span>
            </div>
            <div className="px-4 pt-2 pb-3 flex-1">
              <div className="font-bold text-slate-800 text-sm mb-0.5">{eq.name}</div>
              <div className="text-xs text-slate-500 font-medium mb-2">{eq.category}</div>
              <div className="font-bold font-mono text-indigo-600 text-lg mb-2">
                {eq.price} <span className="text-xs font-medium text-slate-500">/ día</span>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Stock: <strong className="text-slate-800">{eq.stock}</strong></span>
                <span>Rentas: <strong className="text-slate-800">{eq.rentals}</strong></span>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                onClick={() => onShowToast('✏️', 'Editar equipo', 'Disponible en versión final')}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => onShowToast('📊', 'Historial', `Historial de rentas de ${eq.name}`)}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Historial
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
