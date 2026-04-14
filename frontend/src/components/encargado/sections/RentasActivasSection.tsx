import { useEffect, useState } from 'react';
import { solicitudesService } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../../types/solicitud.types';

export default function RentasActivasSection() {
  const [solicitudes, setSolicitudes] = useState<SolicitudRenta[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [firmaModal,  setFirmaModal]  = useState<string | null>(null); // base64 firma

  useEffect(() => {
    solicitudesService.getActivasMias()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las rentas activas.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rentas Activas</h1>
        <p className="text-sm text-slate-500 mt-1">Equipos actualmente rentados por tus clientes</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : solicitudes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <RentaActivaCard
              key={s.id}
              solicitud={s}
              onVerFirma={() => setFirmaModal(s.firmaCliente)}
            />
          ))}
        </div>
      )}

      {/* Modal firma */}
      {firmaModal && (
        <FirmaViewModal firma={firmaModal} onClose={() => setFirmaModal(null)} />
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function RentaActivaCard({
  solicitud,
  onVerFirma,
}: {
  solicitud:  SolicitudRenta;
  onVerFirma: () => void;
}) {
  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as Extract<ItemSnapshot, { kind: 'maquinaria' }>[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as Extract<ItemSnapshot, { kind: 'granel' }>[];

  // Calcula los días restantes basado en el item con vencimiento más próximo
  const diasRestantes = calcularDiasRestantes(solicitud.items);
  const alertaVencimiento = diasRestantes !== null && diasRestantes <= 3;

  return (
    <div className={`bg-white border border-slate-200 border-l-4 rounded-xl shadow-sm overflow-hidden ${
      alertaVencimiento ? 'border-l-red-400' : 'border-l-indigo-400'
    }`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Activa
          </span>
          {alertaVencimiento && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              Vence en {diasRestantes}d
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
        </div>
        <span className="text-xs text-slate-400">
          Entregado {solicitud.fechaEntrega ? formatFechaCorta(solicitud.fechaEntrega) : '—'}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Cliente */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cliente</p>
          <p className="text-sm font-semibold text-slate-800">{solicitud.cliente.nombre}</p>
          <p className="text-xs font-mono text-slate-400">{solicitud.cliente.id}</p>
          {solicitud.cliente.telefono && (
            <p className="text-xs text-slate-500">{solicitud.cliente.telefono}</p>
          )}
        </div>

        {/* Ítems */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos rentados</p>
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

        {/* Total y acciones */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total</p>
            <p className="text-xl font-bold text-slate-800 font-mono">
              Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {solicitud.firmaCliente && (
            <button
              onClick={onVerFirma}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Ver firma
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Modal Firma ───────────────────────────────────────────────────────────────

function FirmaViewModal({ firma, onClose }: { firma: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Firma del cliente</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          <img src={firma} alt="Firma del cliente" className="w-full" />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p className="text-sm font-medium">Sin rentas activas</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        Aquí aparecerán las rentas que hayas confirmado entregar.
      </p>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function calcularDiasRestantes(items: ItemSnapshot[]): number | null {
  const vencimientos: number[] = [];

  for (const item of items) {
    const inicio = new Date(item.fechaInicio).getTime();
    let duracionMs = 0;
    if (item.unidad === 'dias')    duracionMs = item.duracion * 86400000;
    if (item.unidad === 'semanas') duracionMs = item.duracion * 7 * 86400000;
    if (item.unidad === 'meses')   duracionMs = item.duracion * 30 * 86400000;
    vencimientos.push(inicio + duracionMs);
  }

  if (vencimientos.length === 0) return null;
  const proximo = Math.min(...vencimientos);
  return Math.ceil((proximo - Date.now()) / 86400000);
}
