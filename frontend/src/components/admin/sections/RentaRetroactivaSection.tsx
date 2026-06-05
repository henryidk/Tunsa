import { useState, useMemo, useEffect } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import MaquinariaPickerForm from '../../encargado/MaquinariaPickerForm';
import GranelPickerSection from '../../encargado/GranelPickerSection';
import PaymentModeSelector from '../../encargado/PaymentModeSelector';
import EspecialBadge from '../../shared/EspecialBadge';
import { SolicitudCartTable } from '../../shared/SolicitudCartTable';
import PesadaRetroactivaPickerSection from '../PesadaRetroactivaPickerSection';
import type { PesadaItemRetro } from '../PesadaRetroactivaPickerSection';
import type { Cliente } from '../../../services/clientes.service';
import type { ItemSolicitud, ModalidadPago } from '../../../types/solicitud.types';
import {
  calcSubtotal, calcSubtotalConTarifaOverride,
  formatQ, itemCartKey, unidadLabel,
  descomponerDuracion,
} from '../../../types/solicitud.types';
import { useSolicitudData } from '../../../hooks/useSolicitudData';
import { useSolicitudCart } from '../../../hooks/useSolicitudCart';
import { usePrecioOverride } from '../../../hooks/usePrecioOverride';
import { solicitudesService } from '../../../services/solicitudes.service';
import { equiposService } from '../../../services/equipos.service';
import { useReservadosStore } from '../../../store/reservados.store';
import { usuariosService } from '../../../services/usuarios.service';
import EncargadoSelector from '../../shared/EncargadoSelector';
import type { ItemSnapshot } from '../../../types/solicitud-renta.types';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onNavTo?:     (section: string) => void;
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

function nowDatetimeLocal(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateOnly(datetimeLocal: string): string {
  return datetimeLocal.slice(0, 10);
}

export default function RentaRetroactivaSection({ onNavTo, onShowToast = () => {} }: Props) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [modalidadPago,       setModalidadPago]       = useState<ModalidadPago | null>(null);
  const [notas,               setNotas]               = useState('');
  const [equipoTab,           setEquipoTab]           = useState<'maquinaria' | 'granel' | 'pesada'>('maquinaria');
  const [clienteKey,          setClienteKey]          = useState(0);
  const [showNoPagoModal,     setShowNoPagoModal]     = useState(false);
  const [showNoFechaModal,    setShowNoFechaModal]    = useState(false);
  const [isSubmitting,        setIsSubmitting]        = useState(false);
  const [indefinido,          setIndefinido]          = useState(false);
  const [fechaInicioRenta,    setFechaInicioRenta]    = useState('');
  const [gestionadaPor,          setGestionadaPor]          = useState('');
  const [encargados,             setEncargados]             = useState<{ username: string; nombre: string }[]>([]);
  const [showNoEncargadoModal,   setShowNoEncargadoModal]   = useState(false);
  const [pesadaItem,             setPesadaItem]             = useState<PesadaItemRetro | null>(null);
  const [allEquipos,             setAllEquipos]             = useState<import('../../../types/equipo.types').Equipo[]>([]);
  const [isLoadingPesada,        setIsLoadingPesada]        = useState(false);
  const { reservedIds: reservadosPesada, setAll: setReservadosPesada } = useReservadosStore();

  useEffect(() => {
    usuariosService.getEncargados().then(data => {
      setEncargados(data);
      if (data.length === 1) setGestionadaPor(data[0].username);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (equipoTab !== 'pesada') return;
    setIsLoadingPesada(true);
    Promise.all([equiposService.getAll(), solicitudesService.getEquiposReservados()])
      .then(([equipos, reservados]) => { setAllEquipos(equipos); setReservadosPesada(reservados); })
      .finally(() => setIsLoadingPesada(false));
  }, [equipoTab]);

  const { equiposLiviana, granelData, reservedIds, isLoading, error: dataError, refreshReservedIds } = useSolicitudData();
  const cart           = useSolicitudCart();
  const precioOverride = usePrecioOverride();

  const fechaInicioFija = fechaInicioRenta ? toDateOnly(fechaInicioRenta) : undefined;

  const effectiveTotal = useMemo(
    () => cart.items.reduce((s, item) => {
      const tarifa = precioOverride.get(itemCartKey(item));
      return s + (tarifa !== undefined ? calcSubtotalConTarifaOverride(item, tarifa) : calcSubtotal(item));
    }, 0),
    [cart.items, precioOverride.overrides],
  );

  const equiposDisponibles = useMemo(
    () => equiposLiviana.filter(e => !cart.hasEquipo(e.id) && !reservedIds.has(e.id)),
    [equiposLiviana, cart.items, reservedIds],
  );

  const equiposPesadaDisponibles = useMemo(
    () => allEquipos.filter(e => e.isActive && e.tipo.modalidad === 'PESADA' && !reservadosPesada.has(e.id)),
    [allEquipos, reservadosPesada],
  );

  const handleClienteSelect = (cliente: Cliente | null) => {
    if (cliente?.id !== clienteSeleccionado?.id) {
      setIndefinido(false);
      cart.clear();
      precioOverride.clear();
      setPesadaItem(null);
    }
    setClienteSeleccionado(cliente);
  };

  const handleToggleIndefinido = (val: boolean) => {
    setIndefinido(val);
    cart.clear();
    precioOverride.clear();
    setPesadaItem(null);
    setModalidadPago(null);
  };

  const handleFechaChange = (val: string) => {
    setFechaInicioRenta(val);
    if (cart.items.length > 0 || pesadaItem) {
      cart.clear();
      precioOverride.clear();
      setPesadaItem(null);
    }
  };

  const handleLimpiarItems = () => {
    cart.clear();
    precioOverride.clear();
    setPesadaItem(null);
    setModalidadPago(null);
    setNotas('');
  };

  const handleCancelar = () => {
    cart.clear();
    precioOverride.clear();
    setClienteSeleccionado(null);
    setClienteKey(k => k + 1);
    setModalidadPago(null);
    setNotas('');
    setIndefinido(false);
    setFechaInicioRenta('');
    setGestionadaPor('');
    setPesadaItem(null);
  };

  const handleRegistrar = () => {
    if (!fechaInicioRenta) { setShowNoFechaModal(true);     return; }
    if (!gestionadaPor)    { setShowNoEncargadoModal(true); return; }
    if (!modalidadPago)    { setShowNoPagoModal(true);      return; }
    submitRenta();
  };

  const submitRenta = async () => {
    if (!clienteSeleccionado || !modalidadPago || !fechaInicioRenta) return;
    setIsSubmitting(true);
    try {
      const fechaISO = new Date(fechaInicioRenta).toISOString();

      if (equipoTab === 'pesada' && pesadaItem) {
        const { equipo, extrasSeleccionados, diasSolicitados, unidad, horometroInicial } = pesadaItem;
        await solicitudesService.crearRentaRetroactiva({
          clienteId:        clienteSeleccionado.id,
          fechaInicioRenta: fechaISO,
          modalidad:        modalidadPago,
          notas:            notas.trim() || undefined,
          totalEstimado:    0,
          esIndefinida:     indefinido || undefined,
          gestionadaPor,
          items: [{
            kind:             'pesada' as const,
            equipoId:         equipo.id,
            numeracion:       equipo.numeracion,
            descripcion:      equipo.descripcion,
            fechaInicio:      fechaISO,
            extras:           extrasSeleccionados,
            diasSolicitados:  indefinido ? undefined : diasSolicitados,
            unidad:           indefinido ? undefined : unidad,
            horometroInicial: horometroInicial,
            subtotal:         0,
          } as any],
        });
      } else {
        const items: ItemSnapshot[] = cart.items.flatMap((item): ItemSnapshot[] => {
          if (item.kind === 'maquinaria') {
            const overrideTarifa = precioOverride.get(item.equipo.id);
            const desglose = item.duracion && item.unidad
              ? descomponerDuracion(item.fechaInicio, item.duracion, item.unidad)
              : undefined;
            return [{
              kind:        'maquinaria',
              equipoId:    item.equipo.id,
              numeracion:  item.equipo.numeracion,
              descripcion: item.equipo.descripcion,
              fechaInicio: fechaInicioFija ?? item.fechaInicio,
              duracion:    item.duracion,
              unidad:      item.unidad,
              tarifa:      overrideTarifa ?? item.equipo.rentaDia ?? null,
              subtotal:    overrideTarifa !== undefined ? calcSubtotalConTarifaOverride(item, overrideTarifa) : calcSubtotal(item),
              desglose,
              tarifas: { dia: item.equipo.rentaDia ?? null, semana: item.equipo.rentaSemana ?? null, mes: item.equipo.rentaMes ?? null },
            }];
          }
          if (item.kind === 'granel') {
            const key            = `granel-${item.tipo}`;
            const overrideTarifa = precioOverride.get(key);
            const tarifaCatalogo = item.conMadera
              ? (item.config?.rentaDiaConMadera ?? null)
              : (item.config?.rentaDia ?? null);
            const desglose = item.duracion && item.unidad
              ? descomponerDuracion(item.fechaInicio, item.duracion, item.unidad)
              : undefined;
            const tarifas = item.conMadera
              ? { dia: item.config?.rentaDiaConMadera ?? null, semana: item.config?.rentaSemanaConMadera ?? null, mes: item.config?.rentaMesConMadera ?? null }
              : { dia: item.config?.rentaDia ?? null,          semana: item.config?.rentaSemana ?? null,          mes: item.config?.rentaMes ?? null          };
            return [{
              kind:        'granel',
              tipo:        item.tipo,
              tipoLabel:   item.tipoLabel,
              cantidad:    item.cantidad,
              conMadera:   item.conMadera ?? false,
              fechaInicio: fechaInicioFija ?? item.fechaInicio,
              duracion:    item.duracion,
              unidad:      item.unidad,
              tarifa:      overrideTarifa ?? tarifaCatalogo,
              subtotal:    overrideTarifa !== undefined ? calcSubtotalConTarifaOverride(item, overrideTarifa) : calcSubtotal(item),
              desglose,
              tarifas,
            }];
          }
          return [];
        });

        await solicitudesService.crearRentaRetroactiva({
          clienteId:        clienteSeleccionado.id,
          fechaInicioRenta: fechaISO,
          modalidad:        modalidadPago,
          notas:            notas.trim() || undefined,
          totalEstimado:    effectiveTotal,
          items,
          esIndefinida:     indefinido,
          gestionadaPor,
        });
      }

      onShowToast('success', 'Renta retroactiva registrada', 'La renta quedó activa con la fecha de inicio indicada.');
      handleCancelar();
      void refreshReservedIds();
      onNavTo?.('rentas-activas');
    } catch {
      onShowToast('error', 'Error al registrar', 'No se pudo registrar la renta. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Registrar Renta Retroactiva</h1>
        <p className="text-sm text-slate-500 mt-1">
          Para rentas que ya iniciaron — quedarán activas directamente con la fecha indicada, sin pasar por entrega
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

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 1. Fecha de inicio */}
          <SectionCard
            icon={<CalendarioIcon />}
            title="Fecha de Inicio Real"
            subtitle="La fecha y hora en que el cliente retiró el equipo"
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Fecha y hora <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={fechaInicioRenta}
                  max={nowDatetimeLocal()}
                  onChange={e => handleFechaChange(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              {fechaInicioRenta && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="text-xs text-amber-700">
                    Al cambiar la fecha se limpian los equipos del carrito para evitar inconsistencias.
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* 2. Cliente */}
          <SectionCard
            icon={<UserIcon />}
            title="Cliente de la Renta"
            subtitle={clienteSeleccionado
              ? 'Cliente seleccionado — haz clic en × para cambiar'
              : 'Busca un cliente registrado o regístralo desde aquí'}
          >
            <ClienteSearchWidget key={clienteKey} onSelect={handleClienteSelect} />
            {clienteSeleccionado?.esEspecial && (
              <div className="mt-3 flex items-center justify-between px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-violet-500 leading-none">∞</span>
                  <div>
                    <p className="text-xs font-semibold text-violet-700">Renta indefinida</p>
                    <p className="text-[11px] text-slate-600 leading-snug">El costo se calcula en días al momento de devolver</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleIndefinido(!indefinido)}
                  className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${indefinido ? 'bg-violet-600' : 'bg-slate-300'}`}
                  aria-label="Activar renta indefinida"
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${indefinido ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
          </SectionCard>

          {/* 3. Equipos */}
          <SectionCard
            icon={<EquipoIcon />}
            title="Equipos / Maquinaria"
            subtitle={fechaInicioFija
              ? `Fecha de inicio fijada: ${fechaInicioFija}`
              : 'Selecciona primero la fecha de inicio'}
            locked={!clienteSeleccionado || !fechaInicioRenta}
          >
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
              {([
                { id: 'maquinaria' as const, label: 'Maquinaria liviana' },
                { id: 'granel'     as const, label: 'A granel'           },
                { id: 'pesada'     as const, label: 'Maquinaria pesada'  },
              ]).map(t => {
                const bloqueadoPorPesada  = !!pesadaItem && t.id !== 'pesada';
                const bloqueadoPorLiviana = cart.items.length > 0 && t.id === 'pesada';
                const bloqueado = bloqueadoPorPesada || bloqueadoPorLiviana;
                return (
                  <button key={t.id}
                    onClick={() => { if (!bloqueado) setEquipoTab(t.id); }}
                    title={bloqueadoPorPesada ? 'Quita el equipo pesado primero' : bloqueadoPorLiviana ? 'Quita los ítems livianos primero' : undefined}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      equipoTab === t.id
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : bloqueado
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {equipoTab === 'maquinaria' && (
              <div className="mb-5">
                <MaquinariaPickerForm
                  equiposDisponibles={equiposDisponibles}
                  isLoading={isLoading}
                  onAdd={item => cart.addMaquinaria(item)}
                  indefinido={indefinido}
                  fechaInicioFija={fechaInicioFija}
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
                  indefinido={indefinido}
                  fechaInicioFija={fechaInicioFija}
                />
              </div>
            )}

            {equipoTab === 'pesada' && (
              <PesadaRetroactivaPickerSection
                disponibles={equiposPesadaDisponibles}
                isLoading={isLoadingPesada}
                indefinido={indefinido}
                item={pesadaItem}
                onAdd={setPesadaItem}
                onQuitar={() => setPesadaItem(null)}
              />
            )}

            {equipoTab !== 'pesada' && (
              <SolicitudCartTable
                items={cart.items}
                onRemove={cart.removeAt}
                effectiveTotal={effectiveTotal}
                countMaquinaria={cart.summary.countMaquinaria}
                countGranel={cart.summary.countGranel}
                overrides={precioOverride.overrides}
                onSetOverride={(key, val) => (val === null ? precioOverride.remove(key) : precioOverride.set(key, val))}
              />
            )}
          </SectionCard>

          {/* 4. Condiciones de pago */}
          <SectionCard
            icon={<PagoIcon />}
            title="Condiciones de Pago"
            subtitle="Define cómo y cuándo el cliente realizará el pago"
            locked={!clienteSeleccionado}
          >
            <PaymentModeSelector value={modalidadPago} onChange={setModalidadPago} />
          </SectionCard>

          {/* 4b. Encargado asignado */}
          <SectionCard
            icon={<EncargadoIcon />}
            title="Encargado Asignado"
            subtitle="El encargado que gestionará esta renta (devoluciones, extensiones)"
            locked={!clienteSeleccionado}
          >
            <EncargadoSelector
              value={gestionadaPor}
              onChange={setGestionadaPor}
              encargados={encargados}
            />
          </SectionCard>

          {/* 5. Notas (opcional) */}
          <SectionCard
            icon={<NotasIcon />}
            title="Notas / Observaciones"
            subtitle="Opcional — condiciones especiales o acuerdos adicionales"
            locked={!clienteSeleccionado}
          >
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: Entrega en obra, acuerdo de pago especial, etc."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </SectionCard>

        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
        <RentaResumen
          cliente={clienteSeleccionado}
          items={cart.items}
          summary={{ ...cart.summary, total: effectiveTotal }}
          overrides={precioOverride.overrides}
          modalidadPago={modalidadPago}
          esIndefinida={indefinido}
          fechaInicioRenta={fechaInicioRenta}
          equipoTab={equipoTab}
          pesadaItem={pesadaItem}
          onLimpiarItems={handleLimpiarItems}
          canLimpiarItems={cart.items.length > 0 || !!pesadaItem || !!notas}
          onCancelar={handleCancelar}
          canCancelar={!!clienteSeleccionado}
          canRegistrar={
            !!clienteSeleccionado && !!fechaInicioRenta && !!gestionadaPor && !isSubmitting &&
            (equipoTab === 'pesada' ? !!pesadaItem : cart.items.length > 0)
          }
          onRegistrar={handleRegistrar}
          isSubmitting={isSubmitting}
        />

      </div>

      {/* ── Modal: sin fecha ────────────────────────────────────────────────── */}
      {showNoFechaModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNoFechaModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">Indica la fecha de inicio</p>
              <p className="text-sm text-slate-500 mt-1">Debes indicar cuándo inició la renta antes de registrarla.</p>
            </div>
            <button onClick={() => setShowNoFechaModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: sin encargado ───────────────────────────────────────────── */}
      {showNoEncargadoModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNoEncargadoModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">Selecciona un encargado</p>
              <p className="text-sm text-slate-500 mt-1">Debes asignar un encargado que gestione esta renta antes de registrarla.</p>
            </div>
            <button onClick={() => setShowNoEncargadoModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: sin tipo de pago ─────────────────────────────────────────── */}
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
              <p className="text-sm text-slate-500 mt-1">Debes indicar si la renta es de contado o a crédito antes de registrarla.</p>
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

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon:      React.ReactNode;
  title:     string;
  subtitle:  string;
  children:  React.ReactNode;
  locked?:   boolean;
}

function SectionCard({ icon, title, subtitle, children, locked = false }: SectionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
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
              <span className="text-xs font-medium text-slate-500">Selecciona cliente y fecha primero</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RentaResumenProps {
  cliente:          Cliente | null;
  items:            ItemSolicitud[];
  summary:          { total: number; countMaquinaria: number; countGranel: number };
  overrides?:       Map<string, number>;
  modalidadPago:    ModalidadPago | null;
  esIndefinida:     boolean;
  fechaInicioRenta: string;
  equipoTab:        'maquinaria' | 'granel' | 'pesada';
  pesadaItem:       PesadaItemRetro | null;
  onLimpiarItems:   () => void;
  canLimpiarItems:  boolean;
  onCancelar:       () => void;
  canCancelar:      boolean;
  canRegistrar:     boolean;
  onRegistrar:      () => void;
  isSubmitting:     boolean;
}

function RentaResumen({
  cliente, items, summary, overrides, modalidadPago, esIndefinida, fechaInicioRenta,
  equipoTab, pesadaItem,
  onLimpiarItems, canLimpiarItems, onCancelar, canCancelar,
  canRegistrar, onRegistrar, isSubmitting,
}: RentaResumenProps) {
  const esPesada = equipoTab === 'pesada';
  const itemKey = (item: ItemSolicitud) =>
    item.kind === 'maquinaria' ? item.equipo.id : item.kind === 'granel' ? `granel-${item.tipo}` : item.equipo.id;
  const itemSubtotal = (item: ItemSolicitud) => {
    const tarifa = overrides?.get(itemKey(item));
    return tarifa !== undefined ? calcSubtotalConTarifaOverride(item, tarifa) : calcSubtotal(item);
  };
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  return (
    <div className="w-72 flex-shrink-0 sticky top-20 self-start">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Resumen</div>
            <div className="text-xs text-slate-500">
              {fechaInicioRenta
                ? `Inicio: ${fechaInicioRenta.replace('T', ' ').slice(0, 16)}`
                : 'Se registrará activa directamente'}
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</div>
          {cliente ? (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-slate-800 truncate">{cliente.nombre}</p>
                {cliente.esEspecial && <EspecialBadge />}
              </div>
              <p className="text-xs text-slate-400 font-mono">{cliente.id}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin cliente seleccionado</p>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 border-b border-slate-100 max-h-60 overflow-y-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {esPesada ? 'Equipo asignado' : `Ítems (${items.length})`}
          </div>
          {esPesada ? (
            pesadaItem ? (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">
                    <span className="font-mono text-[10px] text-slate-400">#{pesadaItem.equipo.numeracion} </span>
                    {pesadaItem.equipo.descripcion}
                  </p>
                  {esIndefinida
                    ? <p className="text-[10px] text-violet-500 font-medium">∞ Tiempo indefinido</p>
                    : pesadaItem.diasSolicitados != null
                      ? <p className="text-[10px] text-slate-400">{pesadaItem.diasSolicitados} días acordados</p>
                      : null}
                </div>
                <span className="text-xs font-mono font-semibold text-slate-500 flex-shrink-0 whitespace-nowrap">
                  {formatQ((pesadaItem.equipo.rentaHora ?? 0) + pesadaItem.extrasSeleccionados.reduce((s, e) => s + e.rentaHora, 0))}/hr
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <p className="text-xs text-center">Sin equipo seleccionado</p>
              </div>
            )
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <p className="text-xs text-center">Nada agregado aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={itemKey(item)} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {item.kind === 'maquinaria' ? (
                      <p className="text-xs font-medium text-slate-700 truncate">
                        <span className="font-mono text-[10px] text-slate-400">#{item.equipo.numeracion} </span>
                        {item.equipo.descripcion}
                      </p>
                    ) : item.kind === 'granel' ? (
                      <p className="text-xs font-medium text-slate-700">
                        {item.tipoLabel}<span className="text-slate-400"> × {item.cantidad}</span>
                      </p>
                    ) : null}
                    {(item.kind === 'maquinaria' || item.kind === 'granel') && !item.duracion ? (
                      <p className="text-[10px] text-violet-500 font-medium">Tiempo indefinido</p>
                    ) : (item.kind === 'maquinaria' || item.kind === 'granel') && item.duracion ? (
                      <p className="text-[10px] text-slate-400">{unidadLabel(item.duracion, item.unidad ?? 'dias')}</p>
                    ) : null}
                  </div>
                  <span className={`text-xs font-mono font-semibold flex-shrink-0 ${overrides?.has(itemKey(item)) ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {(item.kind === 'maquinaria' || item.kind === 'granel') && !item.duracion ? '—' : formatQ(itemSubtotal(item))}
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
          {esPesada ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold text-violet-600">∞</span>
              <span className="text-xs text-violet-500 font-medium leading-tight">Se calcula por horómetro al devolver</span>
            </div>
          ) : esIndefinida ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold text-violet-600">∞</span>
              <span className="text-xs text-violet-500 font-medium leading-tight">Se calcula al devolver</span>
            </div>
          ) : (
            <div className="text-2xl font-bold text-slate-800 mt-0.5">
              <span className="text-base font-semibold text-slate-500 mr-0.5">Q</span>
              {summary.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
          <div className="text-xs text-slate-400 mt-0.5">
            {esPesada
              ? (pesadaItem ? '1 equipo pesado' : 'Sin equipo seleccionado')
              : items.length === 0 ? '0 ítems seleccionados' : [
                  summary.countMaquinaria > 0 ? `${summary.countMaquinaria} equipo${summary.countMaquinaria > 1 ? 's' : ''}` : null,
                  summary.countGranel > 0 ? `${summary.countGranel} granel` : null,
                ].filter(Boolean).join(' · ')
            }
          </div>
        </div>

        {/* Acciones */}
        <div className="px-4 py-3 space-y-2 border-t border-slate-100">
          <div className="flex gap-2">
            <button onClick={onLimpiarItems} disabled={!canLimpiarItems}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              Limpiar
            </button>
            <button onClick={onRegistrar} disabled={!canRegistrar}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Registrando...
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Registrar Renta
                </>
              )}
            </button>
          </div>

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
              Cancelar
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 text-center">¿Descartar esta renta?</p>
              <p className="text-[11px] text-red-500 text-center leading-snug">Se borrará el cliente y todos los ítems.</p>
              <div className="flex gap-2 mt-0.5">
                <button onClick={() => setConfirmandoCancelar(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                  No, volver
                </button>
                <button onClick={() => { onCancelar(); setConfirmandoCancelar(false); }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">
                  Sí, descartar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function CalendarioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="12" cy="16" r="2"/>
    </svg>
  );
}

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

function EncargadoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  );
}
