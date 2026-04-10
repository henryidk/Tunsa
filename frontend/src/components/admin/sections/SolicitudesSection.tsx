import { useState } from 'react';
import { useSolicitudes } from '../../../hooks/useSolicitudes';
import { clientesService } from '../../../services/clientes.service';
import { solicitudesService } from '../../../services/solicitudes.service';
import { useSolicitudesStore } from '../../../store/solicitudes.store';
import RechazadasTab from './RechazadasTab';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatFechaCorta, unidadLabel } from '../../../types/solicitud.types';

type Tab = 'pendientes' | 'rechazadas';

export default function SolicitudesSection() {
  const { solicitudes, isLoading, error } = useSolicitudes();
  const [activeTab, setActiveTab] = useState<Tab>('pendientes');

  // findAll() ya no incluye RECHAZADA — solo PENDIENTE y APROBADA
  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE');
  // El conteo de rechazadas del store solo refleja rechazos de esta sesión
  const storeRechazadasCount = useSolicitudesStore(
    s => s.solicitudes.filter(sol => sol.estado === 'RECHAZADA').length,
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitudes de Renta</h1>
          <p className="text-sm text-slate-500 mt-1">
            Solicitudes enviadas por los encargados de máquinas
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">En vivo</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        <TabButton
          label="Pendientes"
          count={isLoading ? null : pendientes.length}
          active={activeTab === 'pendientes'}
          onClick={() => setActiveTab('pendientes')}
        />
        <TabButton
          label="Rechazadas"
          count={storeRechazadasCount > 0 ? storeRechazadasCount : null}
          active={activeTab === 'rechazadas'}
          onClick={() => setActiveTab('rechazadas')}
        />
      </div>

      {/* Tab: Pendientes */}
      {activeTab === 'pendientes' && (
        <>
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-white border border-l-4 border-slate-200 border-l-slate-300 rounded-lg shadow-md animate-pulse" />
              ))}
            </div>
          ) : pendientes.length === 0 ? (
            <EmptyState tab="pendientes" />
          ) : (
            <div className="space-y-3">
              {pendientes.map(s => <SolicitudCard key={s.id} solicitud={s} />)}
            </div>
          )}
        </>
      )}

      {/* Tab: Rechazadas — componente independiente con paginación keyset */}
      {activeTab === 'rechazadas' && <RechazadasTab />}
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({
  label, count, active, onClick,
}: {
  label: string; count: number | null; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
      {count !== null && count > 0 && (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
          active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Solicitud Card ────────────────────────────────────────────────────────────

const ESTADO_BORDER: Record<SolicitudRenta['estado'], string> = {
  PENDIENTE: 'border-l-amber-400',
  APROBADA:  'border-l-emerald-400',
  RECHAZADA: 'border-l-red-400',
};

function SolicitudCard({ solicitud }: { solicitud: SolicitudRenta }) {
  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria');
  const granel     = solicitud.items.filter(i => i.kind === 'granel');

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${ESTADO_BORDER[solicitud.estado]} rounded-lg shadow-md overflow-hidden`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <EstadoBadge estado={solicitud.estado} />
          <span className="text-xs font-mono text-slate-400">
            {solicitud.id.slice(0, 12).toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-slate-400">{tiempoRelativo(solicitud.createdAt)}</span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Cliente */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cliente</p>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{solicitud.cliente.nombre}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{solicitud.cliente.id}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="text-slate-400 font-medium">DPI</span>
              <span className="font-mono">{solicitud.cliente.dpi}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="text-slate-400 font-medium">Tel.</span>
              {solicitud.cliente.telefono
                ? <span>{solicitud.cliente.telefono}</span>
                : <span className="text-slate-400 italic">No registrado</span>
              }
            </div>
          </div>
          <DocumentoButton clienteId={solicitud.cliente.id} tieneDocumento={!!solicitud.cliente.documentoKey} />
        </div>

        {/* Ítems */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Ítems solicitados</p>
          <div className="space-y-2">
            {maquinaria.map((item, i) => <ItemRow key={i} item={item} />)}
            {granel.map((item, i)     => <ItemRow key={i} item={item} />)}
          </div>
        </div>

        {/* Pago y total */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Pago y total</p>
          <span className={`w-fit text-xs font-semibold px-2 py-0.5 rounded-full ${
            solicitud.modalidad === 'CONTADO'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
          </span>
          <p className="text-xl font-bold text-slate-800 font-mono">
            Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Footer */}
      <AccionesFooter solicitud={solicitud} />

    </div>
  );
}

// ── Acciones Footer ───────────────────────────────────────────────────────────

type Accion = 'aprobar' | 'rechazar';

function AccionesFooter({ solicitud }: { solicitud: SolicitudRenta }) {
  const [confirmando, setConfirmando] = useState<Accion | null>(null);
  const [procesando,  setProcesando]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const { updateEstado } = useSolicitudesStore.getState();

  const handleConfirmar = async (accion: Accion) => {
    if (accion !== 'rechazar') return; // aprobar pendiente de implementar
    setProcesando(true);
    setErrorMsg(null);
    try {
      await solicitudesService.rechazar(solicitud.id);
      updateEstado(solicitud.id, 'RECHAZADA');
      setConfirmando(null);
    } catch {
      setErrorMsg('No se pudo rechazar la solicitud. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="border-t border-slate-100 overflow-hidden">
      {errorMsg && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">{errorMsg}</div>
      )}
      {confirmando ? (
        /* ── Estado de confirmación ── */
        <div className={`flex items-center justify-between px-5 py-3 gap-4 transition-colors ${
          confirmando === 'aprobar' ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {confirmando === 'aprobar' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 flex-shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 flex-shrink-0">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
            <p className={`text-sm font-medium ${confirmando === 'aprobar' ? 'text-emerald-800' : 'text-red-800'}`}>
              {confirmando === 'aprobar'
                ? '¿Confirmar aprobación de esta solicitud?'
                : '¿Confirmar rechazo de esta solicitud?'
              }
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmando(null)}
              disabled={procesando}
              className="px-3 py-1.5 text-xs font-semibold rounded-md text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleConfirmar(confirmando)}
              disabled={procesando || confirmando === 'aprobar'}
              title={confirmando === 'aprobar' ? 'Próximamente' : undefined}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md text-white transition-colors ${
                procesando || confirmando === 'aprobar'
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              } ${
                confirmando === 'aprobar' ? 'bg-emerald-500' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {procesando
                ? 'Procesando...'
                : confirmando === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'
              }
            </button>
          </div>
        </div>
      ) : (
        /* ── Estado normal ── */
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Observaciones</p>
            <p className="text-xs text-slate-600 truncate">{solicitud.notas}</p>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Solicitado por</p>
              <p className="text-xs font-semibold text-slate-600">{solicitud.creadaPor}</p>
            </div>
            {solicitud.estado === 'PENDIENTE' && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <button
                  onClick={() => setConfirmando('rechazar')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => setConfirmando('aprobar')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                >
                  Aprobar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: ItemSnapshot }) {
  const tiempo = (
    <span className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
      <span className="inline-flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
        {unidadLabel(item.duracion, item.unidad)}
      </span>
      <span>desde {formatFechaCorta(item.fechaInicio)}</span>
    </span>
  );

  if (item.kind === 'maquinaria') {
    return (
      <div>
        <p className="text-xs text-slate-700">
          <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
          {item.descripcion}
        </p>
        {tiempo}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-700">
        <span className="font-semibold text-slate-500 mr-1">{item.cantidad.toLocaleString('es-GT')}</span>
        {item.tipoLabel}
        {item.conMadera && <span className="text-amber-600 ml-1">(c/madera)</span>}
      </p>
      {tiempo}
    </div>
  );
}

function DocumentoButton({ clienteId, tieneDocumento }: { clienteId: string; tieneDocumento: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  if (!tieneDocumento) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Sin documento
      </span>
    );
  }

  const handleVerDocumento = async () => {
    if (loading) return;
    setError(false);
    setLoading(true);
    try {
      const url = await clientesService.getDocumentoUrl(clienteId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleVerDocumento}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      )}
      {error ? 'Error al abrir' : 'Ver documento'}
      {!loading && !error && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      )}
    </button>
  );
}

function EstadoBadge({ estado }: { estado: SolicitudRenta['estado'] }) {
  const map = {
    PENDIENTE: { cls: 'bg-amber-100 text-amber-700 border-amber-200',   label: 'Pendiente'  },
    APROBADA:  { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Aprobada' },
    RECHAZADA: { cls: 'bg-red-100 text-red-700 border-red-200',          label: 'Rechazada'  },
  };
  const { cls, label } = map[estado];
  return (
    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <p className="text-sm font-medium">Sin solicitudes pendientes</p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        {tab === 'pendientes'
          ? 'Cuando un encargado envíe una solicitud, aparecerá aquí en tiempo real.'
          : ''}
      </p>
    </div>
  );
}

// ── Helpers y helpers ─────────────────────────────────────────────────────────

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  return `hace ${Math.floor(horas / 24)}d`;
}

