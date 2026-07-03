import { useState, Fragment } from 'react';
import ClienteNombre from '../../shared/ClienteNombre';
import ProyectoBadge from '../../shared/ProyectoBadge';
import { useSolicitudes } from '../../../hooks/useSolicitudes';
import { clientesService } from '../../../services/clientes.service';
import { useSolicitudesStore } from '../../../store/solicitudes.store';
import RechazadasTab from './RechazadasTab';
import RechazarModal from '../RechazarModal';
import AprobarModal from '../AprobarModal';
import type { SolicitudRenta, ItemSnapshot, ExtraSeleccionado } from '../../../types/solicitud-renta.types';
import { formatQ, formatFechaCorta, duracionDisplay, type UnidadDuracion } from '../../../types/solicitud.types';

type Tab = 'pendientes' | 'rechazadas';

export default function SolicitudesSection() {
  const { solicitudes, isLoading, error } = useSolicitudes();
  const [activeTab,  setActiveTab]  = useState<Tab>('pendientes');
  const [rechazando, setRechazando] = useState<SolicitudRenta | null>(null);
  const [aprobando,  setAprobando]  = useState<SolicitudRenta | null>(null);

  const { updateEstado } = useSolicitudesStore.getState();

  // findAll() devuelve PENDIENTE y APROBADA — solo mostramos PENDIENTE en esta tab
  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE');
  const storeRechazadasCount = useSolicitudesStore(
    s => s.solicitudes.filter(sol => sol.estado === 'RECHAZADA').length,
  );

  const handleRechazarConfirm = (updated: SolicitudRenta) => {
    updateEstado(updated.id, 'RECHAZADA');
    setRechazando(null);
  };

  const handleAprobarConfirm = (updated: SolicitudRenta) => {
    updateEstado(updated.id, 'APROBADA');
    setAprobando(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Solicitudes de Renta</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
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
              {pendientes.map(s => (
                <SolicitudCard
                  key={s.id}
                  solicitud={s}
                  onRequestAprobar={() => setAprobando(s)}
                  onRequestRechazar={() => setRechazando(s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Rechazadas — componente independiente con paginación keyset */}
      {activeTab === 'rechazadas' && <RechazadasTab />}

      <RechazarModal
        solicitud={rechazando}
        open={rechazando !== null}
        onClose={() => setRechazando(null)}
        onConfirm={handleRechazarConfirm}
      />

      <AprobarModal
        solicitud={aprobando}
        open={aprobando !== null}
        onClose={() => setAprobando(null)}
        onConfirm={handleAprobarConfirm}
      />
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
          ? 'border-brand-600 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
      {count !== null && count > 0 && (
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
          active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Accordion helpers ─────────────────────────────────────────────────────────

type ItemConTarifasSnap = Extract<ItemSnapshot, { kind: 'maquinaria' | 'granel' }>;

function itemSnapKey(item: ItemConTarifasSnap): string {
  return item.kind === 'maquinaria' ? item.equipoId : `granel-${item.tipo}`;
}

function calcCatalogSubtotalSnap(item: ItemConTarifasSnap): number {
  if (!item.tarifaFijada || !item.tarifas) return item.subtotal;
  const cant = item.kind === 'granel' ? item.cantidad : 1;
  if (item.desglose) {
    const { desglose, tarifas } = item;
    return (tarifas.mes    ?? 0) * desglose.meses   * cant
         + (tarifas.semana ?? 0) * desglose.semanas  * cant
         + (tarifas.dia    ?? 0) * desglose.dias     * cant;
  }
  const rate = item.unidad === 'semanas' ? item.tarifas.semana
             : item.unidad === 'meses'   ? item.tarifas.mes
             :                             item.tarifas.dia;
  if (rate != null && item.duracion != null) return rate * item.duracion * cant;
  return item.subtotal;
}

type BandaKey = 'dia' | 'semana' | 'mes';
const UNIDAD_TO_BANDA: Partial<Record<UnidadDuracion, BandaKey>> = {
  dias: 'dia', semanas: 'semana', meses: 'mes',
};
interface BandaInfo { key: BandaKey; label: string; catalogo: number | null; fijada: number | null; aplicada: boolean; subtotal: number | null; }

function buildBandas(item: ItemConTarifasSnap): BandaInfo[] {
  const aplicada = item.unidad ? (UNIDAD_TO_BANDA[item.unidad] ?? null) : null;
  return ([
    { key: 'dia'    as BandaKey, label: 'Por día'    },
    { key: 'semana' as BandaKey, label: 'Por semana' },
    { key: 'mes'    as BandaKey, label: 'Por mes'    },
  ] as const).flatMap(({ key, label }) => {
    const catalogo = item.tarifas?.[key]    ?? null;
    const fijada   = item.tarifaFijada?.[key] ?? null;
    if (catalogo == null && fijada == null) return [];
    const esBandaAplicada = key === aplicada;
    return [{ key, label, catalogo, fijada: fijada ?? catalogo, aplicada: esBandaAplicada, subtotal: esBandaAplicada ? item.subtotal : null }];
  });
}

// ── Accordion helpers — pesada ───────────────────────────────────────────────

type ItemPesadaSnap = Extract<ItemSnapshot, { kind: 'pesada' }>;

function itemPesadaTieneOverride(item: ItemPesadaSnap): boolean {
  const baseModificada = item.tarifaCatalogo != null && item.tarifaEfectiva !== item.tarifaCatalogo;
  const extraModificado = item.extras.some(
    e => e.catalogoRentaHora != null && e.rentaHora !== e.catalogoRentaHora,
  );
  return baseModificada || extraModificado;
}

interface FilaTarifaPesada { label: string; catalogo: number | null; pactada: number; modificada: boolean; }

function buildFilasPesada(item: ItemPesadaSnap): FilaTarifaPesada[] {
  const filas: FilaTarifaPesada[] = [{
    label:      'Equipo base',
    catalogo:   item.tarifaCatalogo ?? null,
    pactada:    item.tarifaEfectiva,
    modificada: item.tarifaCatalogo != null && item.tarifaEfectiva !== item.tarifaCatalogo,
  }];
  item.extras.forEach((e: ExtraSeleccionado) => filas.push({
    label:      e.nombre,
    catalogo:   e.catalogoRentaHora ?? null,
    pactada:    e.rentaHora,
    modificada: e.catalogoRentaHora != null && e.rentaHora !== e.catalogoRentaHora,
  }));
  return filas;
}

// ── Solicitud Card ────────────────────────────────────────────────────────────

const ESTADO_BORDER: Record<SolicitudRenta['estado'], string> = {
  PENDIENTE: 'border-l-amber-400',
  APROBADA:  'border-l-emerald-400',
  RECHAZADA: 'border-l-red-400',
  ACTIVA:    'border-l-emerald-400',
  DEVUELTA:  'border-l-slate-400',
};

function SolicitudCard({
  solicitud,
  onRequestAprobar,
  onRequestRechazar,
}: {
  solicitud:        SolicitudRenta;
  onRequestAprobar: () => void;
  onRequestRechazar: () => void;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const maquinaria = solicitud.items.filter(i => i.kind === 'maquinaria') as ItemConTarifasSnap[];
  const granel     = solicitud.items.filter(i => i.kind === 'granel')     as ItemConTarifasSnap[];
  const pesada     = solicitud.items.filter(i => i.kind === 'pesada')     as ItemPesadaSnap[];

  const totalNormal = solicitud.tieneOverride
    ? [...maquinaria, ...granel].reduce((s, item) => s + calcCatalogSubtotalSnap(item), 0)
    : 0;
  const diferencia  = totalNormal - solicitud.totalEstimado;
  const pct         = totalNormal > 0 ? Math.round((diferencia / totalNormal) * 100) : 0;

  return (
    <div className={`bg-white border-l-4 ${ESTADO_BORDER[solicitud.estado]} rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] overflow-hidden`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <EstadoBadge estado={solicitud.estado} />
          {solicitud.esPesada && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              PESADA
            </span>
          )}
          {solicitud.tieneOverride && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              Tarifas modificadas
            </span>
          )}
          {solicitud.folio && (
            <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
          )}
          <ProyectoBadge proyecto={solicitud.proyecto} />
        </div>
        <span className="text-xs text-slate-400">{fechaHora(solicitud.createdAt)}</span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Cliente */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cliente</p>
          <div>
            <ClienteNombre nombre={solicitud.cliente.nombre} esEspecial={solicitud.cliente.esEspecial} textCls="text-sm font-semibold text-slate-800 leading-snug" />
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
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ítems solicitados</p>
          <div className="space-y-1.5">
            {maquinaria.map((item, i) =>
              item.tarifaFijada
                ? <ItemAccordionCard
                    key={i}
                    item={item}
                    isExpanded={expandedItems.has(itemSnapKey(item))}
                    onToggle={() => toggleItem(itemSnapKey(item))}
                  />
                : <ItemRow key={i} item={item} />
            )}
            {granel.map((item, i) =>
              item.tarifaFijada
                ? <ItemAccordionCard
                    key={`g-${i}`}
                    item={item}
                    isExpanded={expandedItems.has(itemSnapKey(item))}
                    onToggle={() => toggleItem(itemSnapKey(item))}
                  />
                : <ItemRow key={`g-${i}`} item={item} />
            )}
            {pesada.map((item, i) =>
              itemPesadaTieneOverride(item)
                ? <ItemAccordionCardPesada
                    key={`p-${i}`}
                    item={item}
                    isExpanded={expandedItems.has(`pesada-${item.equipoId}`)}
                    onToggle={() => toggleItem(`pesada-${item.equipoId}`)}
                  />
                : <ItemRow key={`p-${i}`} item={item} />
            )}
          </div>
          {solicitud.tieneOverride && (
            <p className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Clic en cada ítem para ver u ocultar el desglose de tarifas
            </p>
          )}
        </div>

        {/* Pago y total */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pago y total</p>
          <span className={`w-fit text-xs font-semibold px-2 py-0.5 rounded-full ${
            solicitud.modalidad === 'CONTADO'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito'}
          </span>
          {solicitud.esPesada ? (
            <p className="text-base font-bold text-amber-700">Por horómetro</p>
          ) : solicitud.esIndefinida ? (
            <p className="text-sm font-semibold text-violet-600">∞ A calcular</p>
          ) : (
            <p className="text-xl font-bold text-slate-800 font-mono">
              Q {solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          {solicitud.tieneOverride && !solicitud.esPesada && !solicitud.esIndefinida && diferencia !== 0 && (
            <div className="mt-1 p-2 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-[9px] font-bold uppercase tracking-wide text-violet-600 mb-0.5">Vs. tarifa normal</p>
              <p className="font-mono text-[13px] font-bold text-violet-600">
                {diferencia > 0 ? '−' : '+'}Q {Math.abs(diferencia).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {diferencia > 0 ? '−' : '+'}{Math.abs(pct)}% del precio base
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <AccionesFooter
        solicitud={solicitud}
        onRequestAprobar={onRequestAprobar}
        onRequestRechazar={onRequestRechazar}
      />

    </div>
  );
}

// ── Acciones Footer ───────────────────────────────────────────────────────────

function AccionesFooter({
  solicitud,
  onRequestAprobar,
  onRequestRechazar,
}: {
  solicitud:         SolicitudRenta;
  onRequestAprobar:  () => void;
  onRequestRechazar: () => void;
}) {
  return (
    <div className="border-t border-slate-100">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Observaciones</p>
          <p className="text-xs text-slate-600 truncate">{solicitud.notas}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Solicitado por</p>
            <p className="text-xs font-semibold text-slate-600">{solicitud.creadaPor}</p>
          </div>
          {solicitud.estado === 'PENDIENTE' && (
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              <button
                onClick={onRequestRechazar}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={onRequestAprobar}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                Aprobar
              </button>
            </div>
          )}
          {solicitud.estado === 'APROBADA' && (
            <div className="pl-4 border-l border-slate-200">
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Aprobada — pendiente de entrega
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item Accordion Card ───────────────────────────────────────────────────────

function ItemAccordionCard({
  item,
  isExpanded,
  onToggle,
}: {
  item:       ItemConTarifasSnap;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const nombre     = item.kind === 'maquinaria'
    ? item.descripcion
    : `${item.tipoLabel}${item.conMadera ? ' (c/madera)' : ''} ×${item.cantidad.toLocaleString('es-GT')} u`;
  const numeracion = item.kind === 'maquinaria' ? item.numeracion : null;
  const durStr     = item.duracion != null && item.unidad ? duracionDisplay(item.duracion, item.unidad) : null;
  const fechaStr   = formatFechaCorta(item.fechaInicio);
  const bandas     = buildBandas(item);

  return (
    <div className={`border rounded-[10px] overflow-hidden ${isExpanded ? 'border-violet-300' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-white text-left cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {numeracion && (
            <span className="font-mono text-[10px] text-slate-400 shrink-0">#{numeracion}</span>
          )}
          <span className="text-xs font-medium text-slate-800 truncate">{nombre}</span>
          <span className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 bg-violet-100 rounded shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="text-[9px] font-semibold text-violet-700">mod.</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Subtotal</p>
            <p className="font-mono text-xs font-bold text-slate-800">
              Q {item.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {durStr && <p className="text-[10px] text-slate-500">{durStr} · {fechaStr}</p>}
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            className={`transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2.5 pt-2 bg-violet-50 border-t border-violet-200">
          <div className="grid grid-cols-[70px_1fr_1fr_1fr] gap-x-2 gap-y-1 items-center mb-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Banda</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 text-center">Original</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600 text-center">Modificada</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 text-right">Subtotal</span>
            {bandas.map(b => (
              <Fragment key={b.key}>
                <span className="text-[10px] text-slate-600">{b.label}{b.aplicada ? ' ✱' : ''}</span>
                <span className="font-mono text-[10px] text-slate-400 line-through text-center">
                  {b.catalogo != null ? `Q${b.catalogo.toLocaleString('es-GT')}` : '—'}
                </span>
                <span className="font-mono text-[10px] font-semibold text-violet-600 text-center">
                  {b.fijada != null ? `Q${b.fijada.toLocaleString('es-GT')}` : '—'}
                </span>
                <span className={`font-mono text-right ${b.subtotal != null ? 'text-[11px] font-bold text-slate-800' : 'text-[10px] text-slate-300'}`}>
                  {b.subtotal != null
                    ? `Q ${b.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </Fragment>
            ))}
          </div>
          <p className="text-[9px] text-slate-400">✱ banda aplicada para este período</p>
        </div>
      )}
    </div>
  );
}

// ── Item Accordion Card — pesada ─────────────────────────────────────────────

function ItemAccordionCardPesada({
  item,
  isExpanded,
  onToggle,
}: {
  item:       ItemPesadaSnap;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const filas = buildFilasPesada(item);

  return (
    <div className={`border rounded-[10px] overflow-hidden ${isExpanded ? 'border-violet-300' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-white text-left cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-mono text-[10px] text-slate-400 shrink-0">#{item.numeracion}</span>
          <span className="text-xs font-medium text-slate-800 truncate">{item.descripcion}</span>
          <span className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 bg-violet-100 rounded shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="text-[9px] font-semibold text-violet-700">mod.</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Facturación</p>
            <p className="font-mono text-xs font-bold text-amber-700">Por horómetro</p>
            <p className="text-[10px] text-slate-500">{item.diasSolicitados} días sol.</p>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            className={`transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2.5 pt-2 bg-violet-50 border-t border-violet-200">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 gap-y-1 items-center mb-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Concepto</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 text-center">Catálogo</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600 text-center">Pactada</span>
            {filas.map((f, i) => (
              <Fragment key={i}>
                <span className="text-[10px] text-slate-600">{f.label}</span>
                <span className="font-mono text-[10px] text-slate-400 line-through text-center">
                  {f.catalogo != null ? `${formatQ(f.catalogo)}/hr` : '—'}
                </span>
                <span className={`font-mono text-[10px] text-center ${f.modificada ? 'font-semibold text-violet-600' : 'text-slate-600'}`}>
                  {formatQ(f.pactada)}/hr
                </span>
              </Fragment>
            ))}
          </div>
          <p className="text-[9px] text-slate-400">El costo real se calcula con las lecturas de horómetro.</p>
        </div>
      )}
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: ItemSnapshot }) {
  if (item.kind === 'pesada') {
    return (
      <div>
        <p className="text-xs text-slate-700">
          <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
          {item.descripcion}
          {item.extras.length > 0 && <span className="text-orange-600 ml-1">({item.extras.map(e => `+${e.nombre}`).join(", ")})</span>}
        </p>
        <span className="inline-flex items-center gap-1.5 mt-0.5 text-xs">
          <span className="font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Por horómetro</span>
          <span className="text-slate-400">{item.diasSolicitados} días sol.</span>
        </span>
      </div>
    );
  }

  const tiempo = (
    <span className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
      <span className="inline-flex items-center gap-1 font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
        {duracionDisplay(item.duracion, item.unidad)}
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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
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
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md hover:bg-brand-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
  const map: Record<SolicitudRenta['estado'], { cls: string; label: string }> = {
    PENDIENTE: { cls: 'bg-amber-100 text-amber-700 border-amber-200',       label: 'Pendiente'  },
    APROBADA:  { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Aprobada'   },
    RECHAZADA: { cls: 'bg-red-100 text-red-700 border-red-200',             label: 'Rechazada'  },
    ACTIVA:    { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Activa'     },
    DEVUELTA:  { cls: 'bg-slate-100 text-slate-600 border-slate-200',       label: 'Devuelta'   },
  };
  const { cls, label } = map[estado];
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fechaHora(fecha: string): string {
  const d = new Date(fecha);
  const dia  = d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dia} · ${hora}`;
}

