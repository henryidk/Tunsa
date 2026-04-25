import type { SolicitudRenta, ItemSnapshot, ExtensionEntry } from '../../types/solicitud-renta.types';
import { formatFechaHora } from '../../types/solicitud.types';
import {
  calcularFinConExtensiones,
  msRestantes,
  msMinimos,
  nivelUrgencia,
  formatTiempoRestante,
  URGENCIA_BADGE,
  URGENCIA_BORDER,
} from '../../utils/renta-tiempo.utils';
import VenceLabel from './VenceLabel';

export interface RentaActivaCardProps {
  solicitud:        SolicitudRenta;
  ahora:            number;
  abriendo:         boolean;
  showEncargado?:   boolean;
  onVerComprobante: () => void;
  onAmpliar?:       () => void;
  onDevolucion:     () => void;
  onHorometro?:     () => void;
}

export default function RentaActivaCard({
  solicitud,
  ahora,
  abriendo,
  showEncargado = false,
  onVerComprobante,
  onAmpliar,
  onDevolucion,
  onHorometro,
}: RentaActivaCardProps) {
  const todayStr = new Date().toISOString().substring(0, 10);
  const estadoHorometro = (() => {
    if (!solicitud.esPesada) return null;
    const ul = solicitud.ultimaLectura;
    if (!ul) return 'sin-registros' as const;
    if (ul.fecha === todayStr && ul.completa)  return 'hoy-completo'  as const;
    if (ul.fecha === todayStr && !ul.completa) return 'hoy-inicio'    as const;
    return 'pendiente' as const;
  })();

  const yaDevueltos = new Set<string>(
    (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
  );
  const itemsPendientes = solicitud.items.filter(item => {
    const ref = item.kind === 'maquinaria' || item.kind === 'pesada' ? item.equipoId : item.tipo;
    return !yaDevueltos.has(ref);
  });

  const maquinaria  = itemsPendientes.filter((i): i is Extract<typeof i, { kind: 'maquinaria' }> => i.kind === 'maquinaria');
  const granel      = itemsPendientes.filter((i): i is Extract<typeof i, { kind: 'granel' }>     => i.kind === 'granel');
  const pesada      = itemsPendientes.filter((i): i is Extract<typeof i, { kind: 'pesada' }>     => i.kind === 'pesada');
  const extensiones = solicitud.extensiones ?? [];
  const inicio      = solicitud.fechaInicioRenta ? new Date(solicitud.fechaInicioRenta) : new Date();
  const msMin       = msMinimos(itemsPendientes, inicio, extensiones, ahora);
  const nivel       = nivelUrgencia(msMin);

  return (
    <div className={`bg-white border border-slate-200 border-l-4 rounded-xl shadow-sm overflow-hidden ${URGENCIA_BORDER[nivel]}`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Activa
          </span>
          {solicitud.esPesada && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              PESADA
            </span>
          )}
          {nivel !== 'ok' && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${URGENCIA_BADGE[nivel]}`}>
              {nivel === 'vencido' ? 'Vencida' : `Vence en ${formatTiempoRestante(msMin, inicio, ahora)}`}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <span className="text-xs text-slate-400">
          Inicio {solicitud.fechaInicioRenta ? formatFechaHora(solicitud.fechaInicioRenta) : '—'}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

        {/* Columna izquierda */}
        <div className="flex flex-col gap-3">
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

          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Total</p>
              {solicitud.esPesada ? (
                <p className="text-base font-bold text-slate-700 leading-none">Por horómetro</p>
              ) : (
                <p className="text-lg font-bold text-slate-800 font-mono leading-none">
                  Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              solicitud.modalidad === 'CONTADO' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
            </span>
          </div>
        </div>

        {/* Columna derecha: equipos */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos rentados</p>
          <div className="space-y-2.5">
            {maquinaria.map((item, i) => (
              <EquipoRow key={i} item={item} inicio={inicio} extensiones={extensiones} ahora={ahora} />
            ))}
            {granel.map((item, i) => (
              <GranelRow key={i} item={item} inicio={inicio} extensiones={extensiones} ahora={ahora} />
            ))}
            {pesada.map((item, i) => (
              <PesadaRow key={i} item={item} />
            ))}
          </div>
        </div>

      </div>

      {/* Footer de acciones */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {solicitud.comprobanteKey && (
            <button
              onClick={onVerComprobante}
              disabled={abriendo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors disabled:opacity-60"
            >
              {abriendo ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              )}
              Ver comprobante
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onHorometro && estadoHorometro && (
            <button
              onClick={onHorometro}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-xs font-semibold text-amber-700 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Horómetro
              {estadoHorometro === 'hoy-completo' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Hoy completo" />
              )}
              {estadoHorometro === 'hoy-inicio' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Falta cierre de hoy" />
              )}
              {(estadoHorometro === 'pendiente' || estadoHorometro === 'sin-registros') && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Pendiente de registro" />
              )}
            </button>
          )}
          {onAmpliar && (
            <button
              onClick={onAmpliar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-xs font-semibold text-indigo-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
              Ampliar renta
            </button>
          )}
          <button
            onClick={onDevolucion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
            </svg>
            Registrar devolución
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Sub-filas de equipos ──────────────────────────────────────────────────────

function EquipoRow({ item, inicio, extensiones, ahora }: {
  item:        Extract<ItemSnapshot, { kind: 'maquinaria' }>;
  inicio:      Date;
  extensiones: ExtensionEntry[];
  ahora:       number;
}) {
  const fin = calcularFinConExtensiones(inicio, item, extensiones);
  const ms  = msRestantes(inicio, item, extensiones, ahora);
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-slate-700 leading-tight">
        <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
        {item.descripcion}
      </p>
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          Vence {formatFechaHora(fin.toISOString())}
        </span>
        <VenceLabel ms={ms} fechaInicio={inicio} ahora={ahora} />
      </div>
    </div>
  );
}

function GranelRow({ item, inicio, extensiones, ahora }: {
  item:        Extract<ItemSnapshot, { kind: 'granel' }>;
  inicio:      Date;
  extensiones: ExtensionEntry[];
  ahora:       number;
}) {
  const fin = calcularFinConExtensiones(inicio, item, extensiones);
  const ms  = msRestantes(inicio, item, extensiones, ahora);
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-slate-700 leading-tight">
        <span className="font-mono text-indigo-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
        {item.tipoLabel}
        {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
      </p>
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          Vence {formatFechaHora(fin.toISOString())}
        </span>
        <VenceLabel ms={ms} fechaInicio={inicio} ahora={ahora} />
      </div>
    </div>
  );
}

function PesadaRow({ item }: { item: Extract<ItemSnapshot, { kind: 'pesada' }> }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-slate-700 leading-tight">
        <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
        {item.descripcion}
        {item.conMartillo && <span className="text-orange-600 ml-1">(+martillo)</span>}
      </p>
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.diasSolicitados} días sol.</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
          {item.tarifaEfectiva.toLocaleString('es-GT', { minimumFractionDigits: 2 })}/hr
        </span>
      </div>
    </div>
  );
}
