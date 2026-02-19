// ClientesSection.tsx — directorio de clientes registrados

interface ClientesSectionProps {
  onShowToast: (icon: string, title: string, msg: string) => void
  onOpenModal: (rentaId: string) => void
}

const Avatar = ({ initials }: { initials: string }) => (
  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
    {initials}
  </div>
)

export default function ClientesSection({ onShowToast }: ClientesSectionProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Directorio de clientes registrados en el sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Buscar cliente..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[220px]"
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400">
          <option>Todos</option>
          <option>Con documentación</option>
          <option>Sin documentación</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Cliente', 'Código', 'DPI', 'Teléfono', 'Documentación', 'Rentas totales', 'Última renta', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Juan Choc */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="JC" /><span className="font-semibold text-slate-800">Juan Choc</span></div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">CLI-0042</code>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">2345 67890 1234</td>
                <td className="px-4 py-3 text-slate-700">5555-1234</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">✓ OK</span></td>
                <td className="px-4 py-3 font-bold text-slate-800 text-center">12</td>
                <td className="px-4 py-3 text-xs text-slate-500">Hoy</td>
                <td className="px-4 py-3">
                  <button onClick={() => onShowToast('👤', 'Perfil', 'Ver perfil de cliente (próximamente)')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver perfil</button>
                </td>
              </tr>
              {/* María González */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="MG" /><span className="font-semibold text-slate-800">María González</span></div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">CLI-0028</code>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">3456 78901 2345</td>
                <td className="px-4 py-3 text-slate-700">4444-5678</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">✓ OK</span></td>
                <td className="px-4 py-3 font-bold text-slate-800 text-center">7</td>
                <td className="px-4 py-3 text-xs text-slate-500">15 Feb</td>
                <td className="px-4 py-3">
                  <button onClick={() => onShowToast('👤', 'Perfil', 'Ver perfil de cliente (próximamente)')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver perfil</button>
                </td>
              </tr>
              {/* Roberto Ajú */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="RA" /><span className="font-semibold text-slate-800">Roberto Ajú</span></div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">CLI-0019</code>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">4567 89012 3456</td>
                <td className="px-4 py-3 text-slate-700">3333-9012</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">⚠ Pendiente</span></td>
                <td className="px-4 py-3 font-bold text-slate-800 text-center">3</td>
                <td className="px-4 py-3 text-xs text-slate-500">10 Feb</td>
                <td className="px-4 py-3">
                  <button onClick={() => onShowToast('👤', 'Perfil', 'Ver perfil de cliente (próximamente)')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver perfil</button>
                </td>
              </tr>
              {/* Ferretería El Progreso */}
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><Avatar initials="FP" /><span className="font-semibold text-slate-800">Ferretería El Progreso</span></div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">CLI-0011</code>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">5678 90123 4567</td>
                <td className="px-4 py-3 text-slate-700">2222-3456</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">✓ OK</span></td>
                <td className="px-4 py-3 font-bold text-slate-800 text-center">34</td>
                <td className="px-4 py-3 text-xs text-slate-500">12 Feb</td>
                <td className="px-4 py-3">
                  <button onClick={() => onShowToast('👤', 'Perfil', 'Ver perfil de cliente (próximamente)')} className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">Ver perfil</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-sm text-slate-500">Mostrando 1–4 de 142 clientes</span>
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
