import { useState } from 'react';
import { useAprobadasStore } from '../../../store/aprobadas.store';
import EntregaFirmaModal from '../EntregaFirmaModal';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../../types/solicitud.types';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

export default function PorEntregarSection({ onShowToast = () => {} }: Props) {
  const solicitudes = useAprobadasStore(s => s.solicitudes);
  const removeSolicitud = useAprobadasStore(s => s.removeSolicitud);

  const [entregando, setEntregando] = useState<SolicitudRenta | null>(null);

  const handleEntregaConfirmada = (updated: SolicitudRenta) => {
    removeSolicitud(updated.id);
    onShowToast(
      'success',
      'Entrega registrada',
      `Renta para ${updated.cliente.nombre} está activa.`,
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Por Entregar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Solicitudes aprobadas — coordina la entrega y captura la firma del cliente
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
              onRegistrarEntrega={() => setEntregando(s)}
            />
          ))}
        </div>
      )}

      <EntregaFirmaModal
        solicitud={entregando}
        open={entregando !== null}
        onClose={() => setEntregando(null)}
        onConfirm={handleEntregaConfirmada}
      />
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function SolicitudAprobadaCard({
  solicitud,
  onRegistrarEntrega,
}: {
  solicitud:         SolicitudRenta;
  onRegistrarEntrega: () => void;
}) {
  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-xl shadow-sm overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-amber-50/60">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendiente de entrega
          </span>
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
                  {unidadLabel(item.duracion, item.unidad)} desde {formatFechaCorta(item.fechaInicio)}
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
                  {unidadLabel(item.duracion, item.unidad)} desde {formatFechaCorta(item.fechaInicio)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pago y acción */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total estimado</p>
            <p className="text-xl font-bold text-slate-800 font-mono">
              Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </p>
            <span className={`text-[11px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${
              solicitud.modalidad === 'CONTADO'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
            </span>
          </div>

          <button
            onClick={onRegistrarEntrega}
            className="mt-auto inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
            Registrar Entrega
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[11px] text-slate-500 truncate max-w-xs">
          <span className="font-medium text-slate-400">Obs:</span> {solicitud.notas}
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
