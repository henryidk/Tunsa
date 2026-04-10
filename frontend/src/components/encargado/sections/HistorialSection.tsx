export default function HistorialSection() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Historial de Rentas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro de rentas finalizadas
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-600">Próximamente</p>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            El historial de rentas finalizadas estará disponible en una próxima versión.
          </p>
        </div>
      </div>
    </div>
  );
}
