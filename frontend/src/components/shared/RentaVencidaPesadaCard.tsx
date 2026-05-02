import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import { formatFechaHora } from '../../types/solicitud.types';
import { calcularVentanaGracia, msAtraso, formatAtraso, calcularRecargoPesada } from '../../utils/renta-tiempo.utils';
import { today } from '../../utils/horometro.utils';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

export interface RentaVencidaPesadaCardProps {
  solicitud:        SolicitudRenta;
  ahora:            number;
  abriendo:         boolean;
  showEncargado?:   boolean;
  onVerComprobante: () => void;
  onAmpliar:        () => void;
  onGracia:         () => void;
  onDevolucion:     () => void;
}

export default function RentaVencidaPesadaCard({
  solicitud,
  ahora,
  abriendo,
  showEncargado = false,
  onVerComprobante,
  onAmpliar,
  onGracia,
  onDevolucion,
}: RentaVencidaPesadaCardProps) {
  const extensiones   = solicitud.extensiones ?? [];
  const vencimiento   = new Date(solicitud.fechaFinEstimada!);
  const atrasoMs      = msAtraso(vencimiento, ahora);
  const ventanaGracia = calcularVentanaGracia(extensiones);
  const enGracia      = atrasoMs <= ventanaGracia;

  const pesadaItems  = solicitud.items.filter((i): i is PesadaItem => i.kind === 'pesada');
  const penalizacion = calcularRecargoPesada(solicitud.items, vencimiento, ahora, ventanaGracia);
  const total        = solicitud.costoAcumuladoPesada + penalizacion;

  const hoy = today();
  const lecturaPendienteHoy = !solicitud.ultimaLectura
    || solicitud.ultimaLectura.fecha !== hoy
    || !solicitud.ultimaLectura.completa;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden border-l-4 ${enGracia ? 'border-l-amber-400' : 'border-l-red-500'}`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5 flex-wrap">
          {enGracia ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              En gracia
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Vencida
            </span>
          )}
          {!enGracia && (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Atraso: {formatAtraso(atrasoMs, ventanaGracia)}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">Debía terminar</p>
          <p className="text-xs font-semibold text-slate-600">{formatFechaHora(vencimiento.toISOString())}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

        {/* Columna izquierda */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
            {solicitud.cliente.telefono && (
              <p className="text-xs text-slate-500 mt-0.5">{solicitud.cliente.telefono}</p>
            )}
          </div>

          {showEncargado && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Encargado</p>
              <p className="text-xs font-mono text-slate-600">{solicitud.creadaPor}</p>
            </div>
          )}

          {/* Desglose de costos */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Costo acumulado (horómetro)</span>
              <span className="font-mono">Q {solicitud.costoAcumuladoPesada.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={penalizacion > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>Penalización (5 hrs mín.)</span>
              <span className={`font-mono ${penalizacion > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {penalizacion > 0
                  ? `+ Q ${penalizacion.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                  : '— (dentro de gracia)'}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between">
              <span className="text-sm font-bold text-slate-800">Total estimado</span>
              <span className="text-sm font-bold font-mono text-slate-900">
                Q {total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400">Inicio de renta</p>
            <p className="text-xs font-semibold text-slate-600">
              {solicitud.fechaInicioRenta ? formatFechaHora(solicitud.fechaInicioRenta) : '—'}
            </p>
          </div>
        </div>

        {/* Columna derecha: equipos */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos a devolver</p>

          {lecturaPendienteHoy && (
            <div className="mb-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-[10px] text-amber-700 font-semibold">Lectura de horómetro pendiente hoy</span>
            </div>
          )}

          <div className="space-y-2">
            {pesadaItems.map((item, i) => (
              <PesadaRow
                key={i}
                item={item}
                penalizacion={enGracia ? 0 : item.tarifaEfectiva * 5}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Footer de acciones */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {solicitud.comprobanteKey && (
              <button onClick={onVerComprobante} disabled={abriendo} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors disabled:opacity-60">
                {abriendo
                  ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                Ver comprobante
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGracia} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-xs font-semibold text-amber-600 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Tiempo de gracia
            </button>
            <button onClick={onAmpliar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-xs font-semibold text-indigo-600 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
              Ampliar renta
            </button>
            <button onClick={onDevolucion} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
              Registrar devolución
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function PesadaRow({ item, penalizacion }: {
  item:        PesadaItem;
  penalizacion: number;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <p className="text-xs font-medium text-slate-700 leading-tight">
        <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
        {item.descripcion}
        {item.conMartillo && (
          <span className="ml-1.5 text-[10px] font-semibold text-amber-600">+Martillo</span>
        )}
      </p>
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[10px] font-mono text-amber-700 font-semibold">
          Q{item.tarifaEfectiva.toLocaleString('es-GT', { minimumFractionDigits: 2 })}/hr
        </span>
        {penalizacion > 0 && (
          <span className="text-[10px] font-semibold text-red-600 font-mono">
            +Q {penalizacion.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
