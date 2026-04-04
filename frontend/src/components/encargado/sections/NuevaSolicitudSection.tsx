// NuevaSolicitudSection.tsx — formulario de nueva solicitud de renta (interfaz vacía)

interface Props {
  onNavTo?: (section: string) => void;
}

export default function NuevaSolicitudSection(_props: Props) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Solicitud de Renta</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registra los datos del cliente y agrega los equipos que necesita rentar
        </p>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── LEFT PANEL ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 1. Cliente */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Cliente de la Solicitud</div>
                <div className="text-xs text-slate-500">Busca un cliente registrado o registra uno nuevo primero</div>
              </div>
            </div>
            <div className="px-5 py-5">

              {/* Search bar */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  readOnly
                  placeholder="Buscar cliente por nombre o código CLI-XXXX..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 bg-slate-50 focus:outline-none focus:border-indigo-400 focus:bg-white"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400 font-medium">¿Cliente nuevo?</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* CTA new client */}
              <div className="flex items-start gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 mb-0.5">Registrar antes de continuar</div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    El cliente debe estar registrado en el sistema para poder crear una solicitud.
                    El registro incluye sus datos y documentación.
                  </div>
                </div>
                <button
                  disabled
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium shadow-sm flex-shrink-0 opacity-60 cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  Registrar nuevo cliente
                </button>
              </div>
            </div>
          </div>

          {/* 2. Equipos */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Equipos / Maquinaria</div>
                <div className="text-xs text-slate-500">Cada equipo puede tener su propia fecha y duración de renta</div>
              </div>
            </div>
            <div className="px-5 py-5">

              {/* Add zone */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Agregar equipo</div>

                {/* Row 1: equipo + cantidad */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Equipo <span className="text-red-500">*</span>
                    </label>
                    <select disabled className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 bg-white opacity-60 cursor-not-allowed">
                      <option>Seleccionar equipo...</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Cantidad</label>
                    <input type="number" disabled value={1} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 bg-white opacity-60 cursor-not-allowed" />
                  </div>
                </div>

                {/* Row 2: fecha + duración + button */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Fecha de Inicio <span className="text-red-500">*</span>
                    </label>
                    <input type="date" disabled className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 bg-white opacity-60 cursor-not-allowed" />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Duración (días) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" disabled value={1} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 bg-white opacity-60 cursor-not-allowed" />
                  </div>
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium opacity-40 cursor-not-allowed flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar Equipo
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400 font-medium">Equipos en la solicitud</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* Empty table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['#', 'Equipo', 'Cant.', 'Fecha Inicio', 'Días', 'Q / día', 'Subtotal', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 first:text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M22 12H18L15 21L9 3L6 12H2" />
                          </svg>
                          <p className="text-sm">Aún no has agregado equipos</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. Notas */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Notas / Observaciones</div>
                <div className="text-xs text-slate-500">Condiciones especiales o acuerdos adicionales (opcional)</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <textarea
                disabled
                rows={3}
                placeholder="Ej: El cliente necesita entrega en obra, pago en efectivo, etc."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 placeholder:text-slate-300 resize-none bg-slate-50 opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

        </div>

        {/* ── RIGHT PANEL: Resumen ── */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-20">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Resumen de Solicitud</div>
                <div className="text-xs text-slate-500">Detalle y total estimado</div>
              </div>
            </div>

            {/* Empty items state */}
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <p className="text-xs text-center">Aún no hay equipos<br />en la solicitud</p>
            </div>

            {/* Total panel */}
            <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">Total Estimado</span>
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-0.5">
                <span className="text-base font-semibold text-slate-500 mr-0.5">Q</span>0.00
              </div>
              <div className="text-xs text-slate-400">0 equipos seleccionados</div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 flex gap-2 border-t border-slate-100">
              <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm font-medium opacity-40 cursor-not-allowed">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Limpiar
              </button>
              <button disabled className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium opacity-40 cursor-not-allowed">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                </svg>
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
