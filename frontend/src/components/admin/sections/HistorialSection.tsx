// HistorialSection.tsx — registro completo de rentas

interface HistorialSectionProps {
  onShowToast: (icon: string, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

const EquipTag = ({ label }: { label: string }) => (
  <span className="text-[11.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
    {label}
  </span>
)

export default function HistorialSection({ onShowToast }: HistorialSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Rentas</h1>
          <p className="text-sm text-slate-500 mt-1">Registro completo de todas las rentas del sistema</p>
        </div>
        <button
          onClick={() => onShowToast('📄', 'Exportando', 'Descargando CSV del historial...')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Buscar en historial..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[220px]"
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Todos los estados</option>
          <option>Completada</option>
          <option>Vencida</option>
          <option>Rechazada</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Todo el tiempo</option>
          <option>Este mes</option>
          <option>Mes pasado</option>
          <option>2025</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['ID', 'Cliente', 'Equipos', 'Período', 'Total cobrado', 'Estado', 'Encargado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Completada */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-080</td>
                <td className="px-4 py-3 text-slate-800 font-medium">Pedro Caal Tun</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Niveladora Láser" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">01–08 Feb</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q840</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Completada</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">Juan Pérez</td>
                <td className="px-4 py-3"><button className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver</button></td>
              </tr>
              {/* Completada 2 */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-079</td>
                <td className="px-4 py-3 text-slate-800 font-medium">Marta López</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Compresor" /><EquipTag label="Taladro" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">28 Ene–04 Feb</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q2,450</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Completada</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">Ana López</td>
                <td className="px-4 py-3"><button className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver</button></td>
              </tr>
              {/* Devolución tardía */}
              <tr className="bg-red-50 border-b border-slate-100 hover:bg-red-100 transition-colors">
                <td className="px-4 py-3 font-bold font-mono text-slate-800">RNT-2024-075</td>
                <td className="px-4 py-3 text-slate-800 font-medium">Luis Cucul</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><EquipTag label="Mezcladora" /></div></td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">15–28 Ene</td>
                <td className="px-4 py-3 font-bold font-mono text-slate-800">Q3,080</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fce7f3', color: '#9d174d' }}>
                    Dev. tardía
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">Juan Pérez</td>
                <td className="px-4 py-3"><button className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-sm text-slate-500">Mostrando 1–3 de 76 registros</span>
          <div className="flex items-center gap-1">
            {['←', '1', '2', '3', '...', '26', '→'].map((p, i) => (
              p === '...' ? (
                <span key={i} className="text-sm px-1.5 text-slate-400">...</span>
              ) : (
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
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
