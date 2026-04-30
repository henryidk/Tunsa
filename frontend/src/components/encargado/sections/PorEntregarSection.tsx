import { useState } from 'react';
import { useAprobadasStore } from '../../../store/aprobadas.store';
import { useActivasStore } from '../../../store/activas.store';
import SubirComprobanteModal from '../SubirComprobanteModal';
import { generarComprobante } from '../../../utils/generarComprobante';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { unidadLabel } from '../../../types/solicitud.types';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

export default function PorEntregarSection({ onShowToast = () => {} }: Props) {
  const solicitudes     = useAprobadasStore(s => s.solicitudes);
  const removeSolicitud = useAprobadasStore(s => s.removeSolicitud);
  const updateSolicitud = useAprobadasStore(s => s.updateSolicitud);

  const [entregando,   setEntregando]   = useState<SolicitudRenta | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null);

  const handleEntregaConfirmada = (updated: SolicitudRenta) => {
    removeSolicitud(updated.id);
    useActivasStore.getState().addRenta(updated);
    onShowToast('success', 'Entrega registrada', `Renta para ${updated.cliente.nombre} está activa.`);
  };

  const handleGenerarPdf = async (
    solicitud: SolicitudRenta,
    horometrosIniciales?: { equipoId: string; valor: number }[],
  ) => {
    setGenerandoPdf(solicitud.id);
    try {
      const conFecha = await solicitudesService.iniciarEntrega(solicitud.id, horometrosIniciales);
      updateSolicitud(conFecha);
      await generarComprobante(conFecha);
    } catch {
      onShowToast('error', 'Error al generar PDF', 'No se pudo generar el comprobante. Intenta de nuevo.');
    } finally {
      setGenerandoPdf(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Por Entregar</h1>
          {solicitudes.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
              {solicitudes.length}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Solicitudes aprobadas — genera el comprobante y registra la entrega al cliente
        </p>
      </div>

      {solicitudes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <SolicitudAprobadaCard
              key={s.id}
              solicitud={s}
              generandoPdf={generandoPdf === s.id}
              onGenerarPdf={horometros => handleGenerarPdf(s, horometros)}
              onRegistrarEntrega={() => setEntregando(s)}
            />
          ))}
        </div>
      )}

      <SubirComprobanteModal
        solicitud={entregando}
        open={entregando !== null}
        onClose={() => setEntregando(null)}
        onConfirm={handleEntregaConfirmada}
      />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SolicitudAprobadaCard({
  solicitud,
  generandoPdf,
  onGenerarPdf,
  onRegistrarEntrega,
}: {
  solicitud:          SolicitudRenta;
  generandoPdf:       boolean;
  onGenerarPdf:       (horometrosIniciales?: { equipoId: string; valor: number }[]) => void;
  onRegistrarEntrega: () => void;
}) {
  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];
  const pesada     = solicitud.items.filter(i => i.kind === 'pesada')     as Extract<ItemSnapshot, { kind: 'pesada' }>[];

  // Horómetros iniciales — solo relevante para solicitudes pesadas
  const [horometros, setHorometros] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    pesada.forEach(p => m.set(p.equipoId, p.horometroInicial != null ? String(p.horometroInicial) : ''));
    return m;
  });

  const setHorometro = (equipoId: string, val: string) =>
    setHorometros(prev => new Map(prev).set(equipoId, val));

  const todosHorometrosValidos = pesada.every(p => {
    const v = horometros.get(p.equipoId) ?? '';
    return v.trim() !== '' && !isNaN(parseFloat(v));
  });

  const handleGenerar = () => {
    if (solicitud.esPesada) {
      const horometrosIniciales = pesada.map(p => ({
        equipoId: p.equipoId,
        valor:    parseFloat(horometros.get(p.equipoId) ?? '0'),
      }));
      onGenerarPdf(horometrosIniciales);
    } else {
      onGenerarPdf();
    }
  };

  const puedeGenerar = !solicitud.esPesada || todosHorometrosValidos;

  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-xl shadow-sm overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-amber-50/60">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendiente de entrega
          </span>
          {solicitud.esPesada && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
              PESADA
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <span className="text-xs text-slate-400">{tiempoRelativo(solicitud.updatedAt)}</span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Cliente */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cliente</p>
          <div>
            <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex gap-1.5">
              <span className="text-slate-400 font-medium">DPI</span>
              <span className="font-mono">{solicitud.cliente.dpi}</span>
            </div>
            {solicitud.cliente.telefono && (
              <div className="flex gap-1.5">
                <span className="text-slate-400 font-medium">Tel.</span>
                <span>{solicitud.cliente.telefono}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ítems */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos a entregar</p>
          <div className="space-y-2">
            {maquinaria.map((item, i) => (
              <div key={i}>
                <p className="text-xs text-slate-700">
                  <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                  {item.descripcion}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unidadLabel(item.duracion, item.unidad)}
                </p>
              </div>
            ))}
            {granel.map((item, i) => (
              <div key={i}>
                <p className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
                  {item.tipoLabel}
                  {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unidadLabel(item.duracion, item.unidad)}
                </p>
              </div>
            ))}
            {pesada.map((item, i) => (
              <div key={i}>
                <p className="text-xs text-slate-700">
                  <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                  {item.descripcion}
                  {item.conMartillo && <span className="text-orange-600 ml-1">(+martillo)</span>}
                </p>
                <span className="inline-flex items-center gap-1.5 mt-0.5 text-[11px]">
                  <span className="font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Por horómetro</span>
                  <span className="text-slate-400">{item.diasSolicitados} días sol.</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total y acciones */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total estimado</p>
            {solicitud.esPesada ? (
              <p className="text-base font-bold text-amber-700">Por horómetro</p>
            ) : (
              <p className="text-xl font-bold text-slate-800 font-mono">
                Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
            )}
            <span className={`text-[11px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${
              solicitud.modalidad === 'CONTADO'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
            </span>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={handleGenerar}
              disabled={generandoPdf || !puedeGenerar}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generandoPdf ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Generando...
                </>
              ) : solicitud.fechaInicioRenta ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Volver a generar
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  Generar Comprobante
                </>
              )}
            </button>

            <div className="flex flex-col gap-1">
              <button
                onClick={onRegistrarEntrega}
                disabled={!solicitud.fechaInicioRenta}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Registrar Entrega
              </button>
              {!solicitud.fechaInicioRenta && (
                <p className="text-[11px] text-slate-400 text-center">
                  {solicitud.esPesada && !todosHorometrosValidos
                    ? 'Ingresa los horómetros para continuar'
                    : 'Primero genera el comprobante'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Horómetros iniciales — solo para pesada */}
      {solicitud.esPesada && pesada.length > 0 && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Horómetro inicial al momento de entrega
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pesada.map(item => (
              <div key={item.equipoId} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-600 truncate">
                    <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                    {item.descripcion}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={horometros.get(item.equipoId) ?? ''}
                    onChange={e => setHorometro(item.equipoId, e.target.value)}
                    placeholder="0.0"
                    className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 bg-white text-right"
                  />
                  <span className="text-[11px] text-slate-400 font-medium">hr</span>
                </div>
              </div>
            ))}
          </div>
          {!todosHorometrosValidos && (
            <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Ingresa el horómetro de todos los equipos para generar el comprobante
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[11px] text-slate-500 truncate max-w-xs">
          <span className="font-medium text-slate-400">Obs:</span> {solicitud.notas || '—'}
        </p>
        {solicitud.aprobadaPor && (
          <p className="text-[11px] text-slate-400 flex-shrink-0 ml-4">
            Aprobada por <span className="font-semibold">{solicitud.aprobadaPor}</span>
          </p>
        )}
      </div>

    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
      </svg>
      <p className="text-sm font-medium">Sin entregas pendientes</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        Cuando admin apruebe una solicitud tuya, aparecerá aquí para que registres la entrega.
      </p>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  return `hace ${Math.floor(horas / 24)}d`;
}
