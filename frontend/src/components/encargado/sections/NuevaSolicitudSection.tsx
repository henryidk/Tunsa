// NuevaSolicitudSection.tsx — orquestador del formulario de nueva solicitud

import { useState, useMemo } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import MaquinariaPickerForm from '../MaquinariaPickerForm';
import GranelPickerSection from '../GranelPickerSection';
import PaymentModeSelector from '../PaymentModeSelector';
import type { Cliente } from '../../../services/clientes.service';
import type { ItemSolicitud, ItemMaquinaria, ModalidadPago } from '../../../types/solicitud.types';
import { calcSubtotal, formatQ, formatFechaCorta, unidadLabel, rateSuffix, getRentaRate, descomponerDuracion, formatDesglose, esAdaptado } from '../../../types/solicitud.types';
import { useSolicitudData } from '../../../hooks/useSolicitudData';
import { useSolicitudCart } from '../../../hooks/useSolicitudCart';
import { solicitudesService } from '../../../services/solicitudes.service';
import { usePendientesStore } from '../../../store/pendientes.store';
import type { ItemSnapshot } from '../../../types/solicitud-renta.types';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onNavTo?:     (section: string) => void;
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

export default function NuevaSolicitudSection({ onShowToast = () => {} }: Props) {
  const addPendiente = usePendientesStore(s => s.addSolicitud);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [modalidadPago,       setModalidadPago]       = useState<ModalidadPago | null>(null);
  const [notas,               setNotas]               = useState('');
  const [equipoTab,           setEquipoTab]           = useState<'maquinaria' | 'granel'>('maquinaria');
  const [clienteKey,          setClienteKey]          = useState(0);
  const [showNoPagoModal,     setShowNoPagoModal]     = useState(false);
  const [showNoNotasModal,    setShowNoNotasModal]    = useState(false);
  const [isSubmitting,        setIsSubmitting]        = useState(false);

  const { equiposLiviana, granelData, reservedIds, isLoading, error: dataError, refreshReservedIds } = useSolicitudData();
  const cart = useSolicitudCart();

  // Equipos disponibles: activos, liviana, no en el carrito actual y no reservados en otra solicitud activa
  const equiposDisponibles = useMemo(
    () => equiposLiviana.filter(e => !cart.hasEquipo(e.id) && !reservedIds.has(e.id)),
    [equiposLiviana, cart.items, reservedIds],
  );

  const handleLimpiarItems = () => {
    cart.clear();
    setModalidadPago(null);
    setNotas('');
  };

  const handleCancelarSolicitud = () => {
    cart.clear();
    setClienteSeleccionado(null);
    setClienteKey(k => k + 1);
    setModalidadPago(null);
    setNotas('');
  };

  const handleEnviar = () => {
    if (!modalidadPago) {
      setShowNoPagoModal(true);
      return;
    }
    if (!notas.trim()) {
      setShowNoNotasModal(true);
      return;
    }
    submitSolicitud();
  };

  const submitSolicitud = async () => {
    if (!clienteSeleccionado || !modalidadPago) return;
    setShowNoNotasModal(false);
    setIsSubmitting(true);
    try {
      const items: ItemSnapshot[] = cart.items.map(item => {
        if (item.kind === 'maquinaria') {
          return {
            kind:        'maquinaria',
            equipoId:    item.equipo.id,
            numeracion:  item.equipo.numeracion,
            descripcion: item.equipo.descripcion,
            fechaInicio: item.fechaInicio,
            duracion:    item.duracion,
            unidad:      item.unidad,
            // Siempre tarifa diaria: el recargo por atraso se calcula en días
            tarifa:      item.equipo.rentaDia ?? null,
            subtotal:    calcSubtotal(item),
          };
        }
        return {
          kind:        'granel',
          tipo:        item.tipo,
          tipoLabel:   item.tipoLabel,
          cantidad:    item.cantidad,
          conMadera:   item.conMadera,
          fechaInicio: item.fechaInicio,
          duracion:    item.duracion,
          unidad:      item.unidad,
          // Siempre tarifa diaria: el recargo por atraso se calcula en días
          tarifa:      item.conMadera
            ? (item.config?.rentaDiaConMadera ?? null)
            : (item.config?.rentaDia ?? null),
          subtotal:    calcSubtotal(item),
        };
      });

      const nuevaSolicitud = await solicitudesService.create({
        clienteId:     clienteSeleccionado.id,
        modalidad:     modalidadPago,
        notas:         notas.trim(),
        totalEstimado: cart.summary.total,
        items,
      });

      addPendiente(nuevaSolicitud);
      onShowToast('success', 'Solicitud enviada', 'La solicitud fue registrada y notificada correctamente.');
      handleCancelarSolicitud();
      void refreshReservedIds();
    } catch {
      onShowToast('error', 'Error al enviar', 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Solicitud de Renta</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registra los datos del cliente y agrega los equipos que necesita rentar
        </p>
      </div>

      {dataError && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {dataError}
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 1. Cliente */}
          <SectionCard
            icon={<UserIcon />}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            title="Cliente de la Solicitud"
            subtitle={clienteSeleccionado
              ? 'Cliente seleccionado — haz clic en × para cambiar'
              : 'Busca un cliente registrado o regístralo desde aquí'}
          >
            <ClienteSearchWidget key={clienteKey} onSelect={setClienteSeleccionado} />
          </SectionCard>

          {/* 2. Equipos */}
          <SectionCard
            icon={<EquipoIcon />}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            title="Equipos / Maquinaria"
            subtitle="Cada ítem tiene su propia fecha de inicio y duración"
            locked={!clienteSeleccionado}
          >
            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
              {([
                { id: 'maquinaria' as const, label: 'Maquinaria liviana' },
                { id: 'granel'     as const, label: 'A granel'           },
              ]).map(t => (
                <button key={t.id} onClick={() => setEquipoTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    equipoTab === t.id
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {equipoTab === 'maquinaria' && (
              <div className="mb-5">
                <MaquinariaPickerForm
                  equiposDisponibles={equiposDisponibles}
                  isLoading={isLoading}
                  onAdd={item => cart.addMaquinaria(item)}
                />
              </div>
            )}

            {equipoTab === 'granel' && (
              <div className="mb-5">
                <GranelPickerSection
                  granelData={granelData}
                  isLoading={isLoading}
                  inCart={tipo => cart.hasGranel(tipo)}
                  onAdd={item => cart.addGranel(item)}
                />
              </div>
            )}

            <CartTable items={cart.items} onRemove={cart.removeAt} summary={cart.summary} />
          </SectionCard>

          {/* 3. Condiciones de pago */}
          <SectionCard
            icon={<PagoIcon />}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            title="Condiciones de Pago"
            subtitle="Define cómo y cuándo el cliente realizará el pago"
            locked={!clienteSeleccionado}
          >
            <PaymentModeSelector value={modalidadPago} onChange={setModalidadPago} />
          </SectionCard>

          {/* 4. Notas */}
          <SectionCard
            icon={<NotasIcon />}
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            title="Notas / Observaciones"
            subtitle="Condiciones especiales o acuerdos adicionales de la renta"
            locked={!clienteSeleccionado}
          >
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: El cliente necesita entrega en obra, pago en efectivo, etc."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </SectionCard>

        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <SolicitudResumen
          cliente={clienteSeleccionado}
          items={cart.items}
          summary={cart.summary}
          modalidadPago={modalidadPago}
          onLimpiarItems={handleLimpiarItems}
          canLimpiarItems={cart.items.length > 0 || !!notas}
          onCancelar={handleCancelarSolicitud}
          canCancelar={!!clienteSeleccionado}
          canEnviar={!!clienteSeleccionado && cart.items.length > 0 && !isSubmitting}
          onEnviar={handleEnviar}
          isSubmitting={isSubmitting}
        />

      </div>

      {/* ── Modal: sin observaciones ──────────────────────────────────────── */}
      {showNoNotasModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNoNotasModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">Observaciones requeridas</p>
              <p className="text-sm text-slate-500 mt-1">No es posible enviar la solicitud sin observaciones. Por favor agrega una nota antes de continuar.</p>
            </div>
            <button onClick={() => setShowNoNotasModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: sin tipo de pago ────────────────────────────────────────── */}
      {showNoPagoModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNoPagoModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">Selecciona el tipo de pago</p>
              <p className="text-sm text-slate-500 mt-1">Debes indicar si la renta es de contado o a crédito antes de enviar la solicitud.</p>
            </div>
            <button onClick={() => setShowNoPagoModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}


    </div>
  );
}

// ── Sub-components (layout-only, sin lógica de negocio) ───────────────────────

interface SectionCardProps {
  icon:       React.ReactNode;
  iconBg:     string;
  iconColor:  string;
  title:      string;
  subtitle:   string;
  children:   React.ReactNode;
  locked?:    boolean;
}

function SectionCard({ icon, iconBg, iconColor, title, subtitle, children, locked = false }: SectionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconColor} flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <div className="relative">
        <div className={`px-5 py-5${locked ? ' select-none pointer-events-none opacity-40' : ''}`}>
          {children}
        </div>
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs font-medium text-slate-500">Selecciona un cliente primero</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CartTableProps {
  items:    ItemSolicitud[];
  onRemove: (idx: number) => void;
  summary:  { total: number; countMaquinaria: number; countGranel: number };
}

function CartTable({ items, onRemove, summary }: CartTableProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs text-slate-400 font-medium">Ítems en la solicitud ({items.length})</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Equipo / Instrumento', 'Cant.', 'Inicio', 'Duración', 'Facturación', 'Subtotal', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M22 12H18L15 21L9 3L6 12H2"/>
                    </svg>
                    <p className="text-sm">Aún no has agregado equipos</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <CartRow key={item.kind === 'maquinaria' ? item.equipo.id : `granel-${item.tipo}`}
                  item={item} onRemove={() => onRemove(idx)} />
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {[
                summary.countMaquinaria > 0 ? `${summary.countMaquinaria} equipo${summary.countMaquinaria > 1 ? 's' : ''}` : null,
                summary.countGranel > 0 ? `${summary.countGranel} granel` : null,
              ].filter(Boolean).join(' · ')}
            </span>
            <span className="text-xs font-bold text-slate-700 font-mono">Total: {formatQ(summary.total)}</span>
          </div>
        )}
      </div>
    </>
  );
}

interface CartRowProps {
  item:     ItemSolicitud;
  onRemove: () => void;
}

function CartRow({ item, onRemove }: CartRowProps) {
  const subtotal = calcSubtotal(item);
  const decomp   = descomponerDuracion(item.fechaInicio, item.duracion, item.unidad);
  const adapted  = esAdaptado(item.unidad, decomp);

  // Tarifa base para mostrar cuando no hay adaptación
  const tarifaBase = item.kind === 'maquinaria'
    ? getRentaRate(item.unidad, item.equipo.rentaDia, item.equipo.rentaSemana, item.equipo.rentaMes)
    : item.config
      ? (item.conMadera
          ? getRentaRate(item.unidad, item.config.rentaDiaConMadera, item.config.rentaSemanaConMadera, item.config.rentaMesConMadera)
          : getRentaRate(item.unidad, item.config.rentaDia, item.config.rentaSemana, item.config.rentaMes))
      : null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="px-3 py-3">
        {item.kind === 'maquinaria' ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{item.equipo.numeracion}
            </span>
            <span className="text-xs font-medium text-slate-800 truncate max-w-[150px]">
              {item.equipo.descripcion}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              Granel
            </span>
            <span className="text-xs font-medium text-slate-800">{item.tipoLabel}</span>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-slate-600">
        {item.kind === 'granel' ? item.cantidad.toLocaleString('es-GT') : '—'}
      </td>
      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatFechaCorta(item.fechaInicio)}
      </td>
      <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
        {unidadLabel(item.duracion, item.unidad)}
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {adapted ? (
          <span className="font-medium text-amber-600">{formatDesglose(decomp)}</span>
        ) : tarifaBase !== null ? (
          <span className="font-mono text-slate-600">
            {formatQ(tarifaBase)}<span className="text-slate-400">{rateSuffix(item.unidad)}{item.kind === 'granel' ? '/u' : ''}</span>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs font-mono font-bold text-slate-800 whitespace-nowrap">
        {formatQ(subtotal)}
      </td>
      <td className="px-3 py-3">
        <button onClick={onRemove}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  );
}

interface SolicitudResumenProps {
  cliente:         Cliente | null;
  items:           ItemSolicitud[];
  summary:         { total: number; countMaquinaria: number; countGranel: number };
  modalidadPago:   ModalidadPago | null;
  onLimpiarItems:  () => void;
  canLimpiarItems: boolean;
  onCancelar:      () => void;
  canCancelar:     boolean;
  canEnviar:       boolean;
  onEnviar:        () => void;
  isSubmitting:    boolean;
}

function SolicitudResumen({ cliente, items, summary, modalidadPago, onLimpiarItems, canLimpiarItems, onCancelar, canCancelar, canEnviar, onEnviar, isSubmitting }: SolicitudResumenProps) {
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  return (
    <div className="w-72 flex-shrink-0 sticky top-20 self-start">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Resumen</div>
            <div className="text-xs text-slate-500">Detalle y total estimado</div>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</div>
          {cliente ? (
            <>
              <p className="text-sm font-semibold text-slate-800 truncate">{cliente.nombre}</p>
              <p className="text-xs text-slate-400 font-mono">{cliente.id}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin cliente seleccionado</p>
          )}
        </div>

        {/* Items list */}
        <div className="px-5 py-3 border-b border-slate-100 max-h-60 overflow-y-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Ítems ({items.length})
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <p className="text-xs text-center">Nada agregado aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.kind === 'maquinaria' ? item.equipo.id : `granel-${item.tipo}`}
                  className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {item.kind === 'maquinaria' ? (
                      <p className="text-xs font-medium text-slate-700 truncate">
                        <span className="font-mono text-[10px] text-slate-400">#{item.equipo.numeracion} </span>
                        {item.equipo.descripcion}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-slate-700">
                        {item.tipoLabel}<span className="text-slate-400"> × {item.cantidad}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{unidadLabel(item.duracion, item.unidad)}</p>
                    {(() => {
                      const d = descomponerDuracion(item.fechaInicio, item.duracion, item.unidad);
                      return esAdaptado(item.unidad, d)
                        ? <p className="text-[10px] text-amber-500 font-medium">→ {formatDesglose(d)}</p>
                        : null;
                    })()}
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-700 flex-shrink-0">
                    {formatQ(calcSubtotal(item))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modalidad de pago */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Pago</div>
          {!modalidadPago ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
              <span className="text-sm text-slate-400 italic">Sin seleccionar</span>
            </div>
          ) : modalidadPago === 'CONTADO' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-700">Contado</span>
              <span className="text-xs text-slate-400 ml-1">— al entregar</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700">A crédito</span>
              <span className="text-xs text-slate-400 ml-1">— al devolver</span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="px-5 py-4 bg-slate-50">
          <span className="text-xs text-slate-500 font-medium">Total estimado</span>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">
            <span className="text-base font-semibold text-slate-500 mr-0.5">Q</span>
            {summary.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {items.length === 0 ? '0 ítems seleccionados' : [
              summary.countMaquinaria > 0 ? `${summary.countMaquinaria} equipo${summary.countMaquinaria > 1 ? 's' : ''}` : null,
              summary.countGranel > 0 ? `${summary.countGranel} granel` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 space-y-2 border-t border-slate-100">

          {/* Fila principal: limpiar ítems + enviar */}
          <div className="flex gap-2">
            <button onClick={onLimpiarItems} disabled={!canLimpiarItems}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              Limpiar
            </button>
            <button onClick={onEnviar} disabled={!canEnviar}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Enviando...</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>Enviar Solicitud</>
              )}
            </button>
          </div>

          {/* Cancelar solicitud completa */}
          {!confirmandoCancelar ? (
            <button
              onClick={() => setConfirmandoCancelar(true)}
              disabled={!canCancelar}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-500 hover:text-red-600 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              Cancelar solicitud
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 text-center">¿Cancelar toda la solicitud?</p>
              <p className="text-[11px] text-red-500 text-center leading-snug">Se borrará el cliente y todos los ítems.</p>
              <div className="flex gap-2 mt-0.5">
                <button
                  onClick={() => setConfirmandoCancelar(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  No, volver
                </button>
                <button
                  onClick={() => { onCancelar(); setConfirmandoCancelar(false); }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

// ── Iconos (SVG inline, sin dependencia externa) ──────────────────────────────

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function EquipoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

function NotasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function PagoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}
