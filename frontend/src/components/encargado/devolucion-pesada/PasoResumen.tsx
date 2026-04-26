import type { ItemRetorno, CargoRow } from './types';
import { formatQ } from './types';
import { formatFechaHora } from '../../../types/solicitud.types';
import type { SolicitudRenta } from '../../../types/solicitud-renta.types';

interface Props {
  solicitud:           SolicitudRenta;
  seleccionados:       ItemRetorno[];
  cargosValidos:       CargoRow[];
  costoAcumPorEquipo:  Map<string, number>;
  costoEstimadoTotal:  number;
  totalCargosAd:       number;
  loadingLectura:      boolean;
  generandoPdf:        boolean;
  pdfBlobUrl:          string | null;
  pdfError:            boolean;
}

export default function PasoResumen({
  solicitud, seleccionados, cargosValidos, costoAcumPorEquipo,
  costoEstimadoTotal, totalCargosAd, loadingLectura, generandoPdf, pdfBlobUrl, pdfError,
}: Props) {
  return (
    <div className="space-y-4">
      {solicitud.fechaInicioRenta && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Período de renta</p>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex-1">
              <p className="text-slate-400 mb-0.5">Inicio</p>
              <p className="font-semibold text-slate-700">{formatFechaHora(solicitud.fechaInicioRenta)}</p>
            </div>
            <svg className="text-slate-300 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            <div className="flex-1">
              <p className="text-slate-400 mb-0.5">Devolución</p>
              <p className="font-semibold text-slate-700">{formatFechaHora(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Equipos a devolver ({seleccionados.length})
        </p>
        <ul className="space-y-2">
          {seleccionados.map(it => (
            <li key={it.equipoId} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
                <span className="text-xs font-mono text-slate-400">#{it.numeracion}</span>
                <span className="text-sm font-medium text-slate-800">{it.descripcion}</span>
                {it.conMartillo && <span className="text-[10px] text-orange-600 font-semibold">(+martillo)</span>}
              </div>
              <div className="flex items-center gap-4 pl-5 text-[11px]">
                <span className="text-slate-400">
                  Tarifa: <span className="font-semibold text-amber-700">{formatQ(it.tarifaEfectiva)}/hr</span>
                </span>
                <span className="text-slate-400">
                  Acumulado:
                  <span className="font-semibold text-slate-700 ml-1">
                    {loadingLectura ? '…' : formatQ(costoAcumPorEquipo.get(it.equipoId) ?? 0)}
                  </span>
                </span>
                {it.horometroDevolucion && (
                  <span className="text-slate-400">
                    Horóm. final: <span className="font-semibold text-slate-700">{it.horometroDevolucion}</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {cargosValidos.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Cargos adicionales</p>
          <ul className="space-y-1">
            {cargosValidos.map((c, i) => (
              <li key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-700">{c.descripcion}</span>
                <span className="text-xs font-bold text-amber-700">{formatQ(c.monto as number)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total estimado</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Incluye horómetro final{cargosValidos.length > 0 ? ' + cargos adicionales' : ''}.
          </p>
        </div>
        <span className="text-lg font-bold text-slate-700 font-mono">
          {loadingLectura ? '…' : formatQ(costoEstimadoTotal + totalCargosAd)}
        </span>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Documento de liquidación</p>
        {generandoPdf ? (
          <div className="flex items-center gap-2 py-0.5">
            <svg className="animate-spin text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span className="text-xs text-slate-500">Generando documento…</span>
          </div>
        ) : pdfBlobUrl ? (
          <a
            href={pdfBlobUrl}
            download={`liquidacion-${solicitud.folio ?? solicitud.id.slice(0, 8)}.pdf`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Descargar liquidación
          </a>
        ) : pdfError ? (
          <p className="text-xs text-slate-400">No se pudo generar el documento.</p>
        ) : null}
        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
          Basada en lecturas registradas. Si ingresas horómetro final, el monto puede incluir horas adicionales.
        </p>
      </div>
    </div>
  );
}
