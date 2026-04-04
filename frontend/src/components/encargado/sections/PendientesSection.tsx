// PendientesSection.tsx — solicitudes pendientes de aprobación (interfaz vacía)

export default function PendientesSection() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pendientes de Aprobación</h1>
          <p className="text-sm text-slate-500 mt-1">Solicitudes esperando aprobación de secretaría</p>
        </div>
        <div className="relative flex-shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            readOnly
            placeholder="Buscar solicitudes..."
            className="pl-8 pr-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 placeholder:text-slate-400 bg-white w-56 focus:outline-none opacity-60 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['ID', 'Fecha', 'Cliente', 'Teléfono', 'Equipo', 'Cantidad', 'Inicio', 'Duración', 'Total', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={10}>
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p className="text-sm">No hay solicitudes pendientes</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
