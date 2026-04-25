import { formatQ } from './types';
import type { SolicitudRenta, DevolucionEntry } from '../../../types/solicitud-renta.types';

interface Props {
  resultado:      SolicitudRenta;
  liquidacionUrl: string | null;
}

export default function PasoResultado({ resultado, liquidacionUrl }: Props) {
  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="text-emerald-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Devolución registrada</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            {resultado.estado === 'DEVUELTA'
              ? 'Renta completada y cerrada.'
              : 'Devolución parcial completada. La renta sigue activa con los equipos pendientes.'}
          </p>
        </div>
      </div>

      {resultado.totalFinal != null && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Resumen de cobro</p>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">Total final facturado</p>
            <span className="text-2xl font-bold text-slate-800">{formatQ(resultado.totalFinal)}</span>
          </div>
          {(() => {
            const devs   = resultado.devolucionesParciales ?? [];
            const ultimo = devs[devs.length - 1] as DevolucionEntry | undefined;
            if (!ultimo || ultimo.recargosAdicionales.length === 0) return null;
            return (
              <>
                <div className="border-t border-slate-200 my-2" />
                <ul className="space-y-1">
                  {ultimo.recargosAdicionales.map((c, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700">{c.descripcion}</span>
                      <span className="text-amber-700 font-medium">{formatQ(c.monto)}</span>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}

      {liquidacionUrl ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Documento de liquidación</p>
          <a
            href={liquidacionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Ver liquidación completa
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <svg className="text-slate-400 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-slate-500">El documento de liquidación no está disponible por el momento. Puedes descargarlo desde el historial.</p>
        </div>
      )}
    </div>
  );
}
