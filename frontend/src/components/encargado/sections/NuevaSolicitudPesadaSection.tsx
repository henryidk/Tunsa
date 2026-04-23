import { useState, useEffect, useMemo, useRef } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import PaymentModeSelector from '../PaymentModeSelector';
import type { Cliente } from '../../../services/clientes.service';
import type { Equipo } from '../../../types/equipo.types';
import type { ModalidadPago } from '../../../types/solicitud.types';
import type { ToastType } from '../../../types/ui.types';
import { equiposService } from '../../../services/equipos.service';
import { solicitudesService } from '../../../services/solicitudes.service';
import { usePendientesStore } from '../../../store/pendientes.store';
import { useReservadosStore } from '../../../store/reservados.store';
import { formatQ } from '../../../types/solicitud.types';

interface Props {
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

interface PesadaItem {
  equipo:          Equipo;
  conMartillo:     boolean;
  diasSolicitados: number;
  fechaInicio:     string;
}

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function NuevaSolicitudPesadaSection({ onShowToast = () => {} }: Props) {
  const addPendiente = usePendientesStore(s => s.addSolicitud);
  const { reservedIds, setAll: setReservedIds } = useReservadosStore();

  const [allEquipos,    setAllEquipos]    = useState<Equipo[]>([]);
  const [isLoadingEqs,  setIsLoadingEqs]  = useState(true);
  const [equiposError,  setEquiposError]  = useState<string | null>(null);

  const [cliente,        setCliente]       = useState<Cliente | null>(null);
  const [clienteKey,     setClienteKey]    = useState(0);
  const [modalidad,      setModalidad]     = useState<ModalidadPago | null>(null);
  const [notas,          setNotas]         = useState('');
  const [items,          setItems]         = useState<PesadaItem[]>([]);
  const [isSubmitting,   setIsSubmitting]  = useState(false);

  const [showNoPagoModal,  setShowNoPagoModal]  = useState(false);
  const [showNoNotasModal, setShowNoNotasModal] = useState(false);

  useEffect(() => {
    Promise.all([
      equiposService.getAll(),
      solicitudesService.getEquiposReservados(),
    ])
      .then(([equipos, reservados]) => {
        setAllEquipos(equipos);
        setReservedIds(reservados);
      })
      .catch(() => setEquiposError('No se pudieron cargar los equipos. Recarga la página.'))
      .finally(() => setIsLoadingEqs(false));
  }, []);

  const pesadaDisponibles = useMemo(
    () => allEquipos.filter(
      e => e.isActive &&
           e.tipo.nombre === 'PESADA' &&
           !reservedIds.has(e.id) &&
           !items.some(it => it.equipo.id === e.id),
    ),
    [allEquipos, reservedIds, items],
  );

  const addEquipo = (item: PesadaItem) => {
    setItems(prev => [...prev, item]);
  };

  const removeEquipo = (equipoId: string) => {
    setItems(prev => prev.filter(it => it.equipo.id !== equipoId));
  };

  const updateItem = (equipoId: string, changes: Partial<Omit<PesadaItem, 'equipo'>>) => {
    setItems(prev => prev.map(it =>
      it.equipo.id === equipoId ? { ...it, ...changes } : it,
    ));
  };

  const getTarifaEfectiva = (item: PesadaItem): number => {
    if (item.conMartillo && item.equipo.rentaHoraMartillo != null) {
      return item.equipo.rentaHoraMartillo;
    }
    return item.equipo.rentaHora ?? 0;
  };

  const handleEnviar = () => {
    if (!modalidad) { setShowNoPagoModal(true); return; }
    if (!notas.trim()) { setShowNoNotasModal(true); return; }
    void submitSolicitud();
  };

  const submitSolicitud = async () => {
    if (!cliente || !modalidad) return;
    setShowNoNotasModal(false);
    setIsSubmitting(true);
    try {
      const snapItems = items.map(it => ({
        kind:            'pesada' as const,
        equipoId:        it.equipo.id,
        numeracion:      it.equipo.numeracion,
        descripcion:     it.equipo.descripcion,
        conMartillo:     it.conMartillo,
        diasSolicitados: it.diasSolicitados,
        duracion:        it.diasSolicitados,
        unidad:          'dias',
        tarifaEfectiva:  getTarifaEfectiva(it),
        subtotal:        0,
      }));

      const nueva = await solicitudesService.create({
        clienteId: cliente.id,
        modalidad,
        notas:     notas.trim(),
        items:     snapItems as any,
      });

      addPendiente(nueva);
      onShowToast('success', 'Solicitud enviada', 'La solicitud fue registrada y notificada correctamente.');
      setCliente(null);
      setClienteKey(k => k + 1);
      setModalidad(null);
      setNotas('');
      setItems([]);
      const reservados = await solicitudesService.getEquiposReservados();
      setReservedIds(reservados);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      const texto = Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo enviar la solicitud.');
      onShowToast('error', 'Error al enviar', texto);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Solicitud — Maquinaria Pesada</h1>
        <p className="text-sm text-slate-500 mt-1">
          Las rentas pesadas se facturan por horómetro real (Q/hora). No hay total estimado.
        </p>
      </div>

      {equiposError && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {equiposError}
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* ── LEFT ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 1. Cliente */}
          <SectionCard
            icon={<UserIcon />}
            title="Cliente de la Solicitud"
            subtitle={cliente ? 'Cliente seleccionado' : 'Busca un cliente registrado'}
          >
            <ClienteSearchWidget key={clienteKey} onSelect={setCliente} />
          </SectionCard>

          {/* 2. Equipos pesados */}
          <SectionCard
            icon={<CraneIcon />}
            title="Maquinaria Pesada"
            subtitle="Selecciona equipos y configura los días y martillo"
            locked={!cliente}
          >
            {/* Picker */}
            <PesadaPickerForm
              disponibles={pesadaDisponibles}
              isLoading={isLoadingEqs}
              onAdd={addEquipo}
            />

            {/* Cart */}
            {items.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">En solicitud ({items.length})</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <div className="space-y-3">
                  {items.map(it => (
                    <ItemRow
                      key={it.equipo.id}
                      item={it}
                      tarifaEfectiva={getTarifaEfectiva(it)}
                      onChange={changes => updateItem(it.equipo.id, changes)}
                      onRemove={() => removeEquipo(it.equipo.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* 3. Pago */}
          <SectionCard icon={<PagoIcon />} title="Condiciones de Pago" subtitle="Contado o crédito" locked={!cliente}>
            <PaymentModeSelector value={modalidad} onChange={setModalidad} />
          </SectionCard>

          {/* 4. Notas */}
          <SectionCard icon={<NotasIcon />} title="Notas / Observaciones" subtitle="Acuerdos especiales" locked={!cliente}>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: Entregar en obra km 15, horario 7am–5pm, etc."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </SectionCard>

        </div>

        {/* ── RIGHT ────────────────────────────────────────────────────────── */}
        <PesadaResumen
          cliente={cliente}
          items={items}
          modalidad={modalidad}
          getTarifa={getTarifaEfectiva}
          canEnviar={!!cliente && items.length > 0 && !isSubmitting}
          isSubmitting={isSubmitting}
          onEnviar={handleEnviar}
          onCancelar={() => {
            setCliente(null); setClienteKey(k => k + 1);
            setModalidad(null); setNotas(''); setItems([]);
          }}
          canCancelar={!!cliente}
        />

      </div>

      {showNoPagoModal && <SimpleModal onClose={() => setShowNoPagoModal(false)} title="Selecciona el tipo de pago" msg="Debes indicar si la renta es de contado o a crédito." variant="amber" />}
      {showNoNotasModal && <SimpleModal onClose={() => setShowNoNotasModal(false)} title="Observaciones requeridas" msg="Agrega una nota antes de continuar." variant="red" />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ItemRowProps {
  item:            { equipo: Equipo; conMartillo: boolean; diasSolicitados: number; fechaInicio: string };
  tarifaEfectiva:  number;
  onChange:        (c: { conMartillo?: boolean; diasSolicitados?: number; fechaInicio?: string }) => void;
  onRemove:        () => void;
}

function ItemRow({ item, tarifaEfectiva, onChange, onRemove }: ItemRowProps) {
  const hasMartillo = item.equipo.rentaHoraMartillo != null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            #{item.equipo.numeracion}
          </span>
          <span className="text-xs font-semibold text-slate-800">{item.equipo.descripcion}</span>
        </div>
        <button onClick={onRemove} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Fecha inicio */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Fecha inicio</label>
          <input
            type="date"
            value={item.fechaInicio}
            onChange={e => onChange({ fechaInicio: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
        {/* Días solicitados */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Días solicitados</label>
          <input
            type="number"
            min="1"
            value={item.diasSolicitados}
            onChange={e => onChange({ diasSolicitados: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Martillo */}
      {hasMartillo && (
        <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={item.conMartillo}
            onChange={e => onChange({ conMartillo: e.target.checked })}
            className="w-4 h-4 accent-orange-500"
          />
          <div>
            <span className="text-xs font-semibold text-slate-700">Con martillo</span>
            <span className="ml-2 text-[11px] text-orange-600">
              {formatQ(item.equipo.rentaHoraMartillo!)}/hr en vez de {formatQ(item.equipo.rentaHora ?? 0)}/hr
            </span>
          </div>
        </label>
      )}

      <div className="mt-2 flex items-center justify-end">
        <span className="text-[11px] text-slate-500">
          Tarifa efectiva: <span className="font-bold text-amber-700">{formatQ(tarifaEfectiva)}/hr</span>
        </span>
      </div>
    </div>
  );
}

interface PesadaResumenProps {
  cliente:      Cliente | null;
  items:        { equipo: Equipo; conMartillo: boolean; diasSolicitados: number }[];
  modalidad:    ModalidadPago | null;
  getTarifa:    (it: any) => number;
  canEnviar:    boolean;
  isSubmitting: boolean;
  onEnviar:     () => void;
  onCancelar:   () => void;
  canCancelar:  boolean;
}

function PesadaResumen({ cliente, items, modalidad, getTarifa, canEnviar, isSubmitting, onEnviar, onCancelar, canCancelar }: PesadaResumenProps) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div className="w-72 flex-shrink-0 sticky top-20 self-start">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
            <CraneIcon />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Resumen Pesada</div>
            <div className="text-xs text-slate-500">Facturación por horómetro</div>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</div>
          {cliente ? (
            <p className="text-sm font-semibold text-slate-800 truncate">{cliente.nombre}</p>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin cliente</p>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 border-b border-slate-100 max-h-52 overflow-y-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipos ({items.length})</div>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin equipos</p>
          ) : (
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.equipo.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      <span className="font-mono text-[10px] text-slate-400">#{it.equipo.numeracion} </span>
                      {it.equipo.descripcion}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {it.diasSolicitados} día{it.diasSolicitados > 1 ? 's' : ''}
                      {it.conMartillo ? ' · +Martillo' : ''}
                    </p>
                    <p className="text-[10px] text-amber-600 font-medium">{formatQ(getTarifa(it))}/hr</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modalidad */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Pago</div>
          {!modalidad ? (
            <span className="text-sm text-slate-400 italic">Sin seleccionar</span>
          ) : modalidad === 'CONTADO' ? (
            <span className="text-sm font-semibold text-emerald-700">Contado</span>
          ) : (
            <span className="text-sm font-semibold text-amber-700">A crédito</span>
          )}
        </div>

        {/* Total info */}
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700 font-medium">Total estimado</p>
          <p className="text-xl font-bold text-amber-800 mt-0.5">Por horómetro</p>
          <p className="text-[11px] text-amber-600 mt-1">
            El costo real se calcula al registrar las lecturas diarias del horómetro.
          </p>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={onEnviar}
            disabled={!canEnviar}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Enviando...</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>Enviar Solicitud</>
            )}
          </button>
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              disabled={!canCancelar}
              className="w-full py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-500 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Cancelar solicitud
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 text-center">¿Cancelar todo?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmando(false)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50">
                  No
                </button>
                <button onClick={() => { onCancelar(); setConfirmando(false); }} className="flex-1 px-2 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium">
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

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon:     React.ReactNode;
  title:    string;
  subtitle: string;
  children: React.ReactNode;
  locked?:  boolean;
}

function SectionCard({ icon, title, subtitle, children, locked = false }: SectionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs font-medium text-slate-500">Selecciona un cliente primero</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SimpleModalProps {
  onClose:  () => void;
  title:    string;
  msg:      string;
  variant:  'red' | 'amber';
}

function SimpleModal({ onClose, title, msg, variant }: SimpleModalProps) {
  const cls = variant === 'red'
    ? { bg: 'bg-red-100', text: 'text-red-500', btn: 'bg-indigo-600 hover:bg-indigo-700' }
    : { bg: 'bg-amber-100', text: 'text-amber-500', btn: 'bg-indigo-600 hover:bg-indigo-700' };
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-full ${cls.bg} flex items-center justify-center`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls.text}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800 text-base">{title}</p>
          <p className="text-sm text-slate-500 mt-1">{msg}</p>
        </div>
        <button onClick={onClose} className={`w-full py-2.5 rounded-xl ${cls.btn} text-white text-sm font-semibold transition-colors`}>
          Entendido
        </button>
      </div>
    </div>
  );
}

// ── PesadaPickerForm ──────────────────────────────────────────────────────────

interface PesadaPickerFormProps {
  disponibles: Equipo[];
  isLoading:   boolean;
  onAdd:       (item: PesadaItem) => void;
}

function PesadaPickerForm({ disponibles, isLoading, onAdd }: PesadaPickerFormProps) {
  const [busqueda,        setBusqueda]        = useState('');
  const [seleccionado,    setSeleccionado]    = useState<Equipo | null>(null);
  const [dropdown,        setDropdown]        = useState(false);
  const [fechaInicio,     setFechaInicio]     = useState(today());
  const [diasSolicitados, setDiasSolicitados] = useState(1);
  const [conMartillo,     setConMartillo]     = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return disponibles
      .filter(e => !q || e.numeracion.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q))
      .slice(0, 8);
  }, [disponibles, busqueda]);

  const hasMartillo = seleccionado?.rentaHoraMartillo != null;

  const tarifaPreview = seleccionado
    ? (conMartillo && seleccionado.rentaHoraMartillo != null
        ? seleccionado.rentaHoraMartillo
        : seleccionado.rentaHora ?? 0)
    : 0;

  const handleSelect = (e: Equipo) => {
    setSeleccionado(e);
    setBusqueda('');
    setDropdown(false);
    setConMartillo(false);
    setError(null);
  };

  const handleAdd = () => {
    if (!seleccionado) { setError('Selecciona un equipo.'); return; }
    if (diasSolicitados < 1) { setError('Los días deben ser al menos 1.'); return; }
    onAdd({ equipo: seleccionado, conMartillo: hasMartillo ? conMartillo : false, diasSolicitados, fechaInicio });
    setSeleccionado(null);
    setBusqueda('');
    setDiasSolicitados(1);
    setConMartillo(false);
    setFechaInicio(today());
    setError(null);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Agregar equipo pesado
      </div>

      {/* Buscador de equipo */}
      <div className="mb-3" ref={containerRef}>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Equipo <span className="text-red-400">*</span>
        </label>
        {seleccionado ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50">
            <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{seleccionado.numeracion}
            </span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{seleccionado.descripcion}</span>
            <button
              onClick={() => { setSeleccionado(null); setConMartillo(false); setError(null); }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setDropdown(true); setError(null); }}
              onFocus={() => setDropdown(true)}
              placeholder={isLoading ? 'Cargando equipos...' : 'Buscar por número o descripción...'}
              disabled={isLoading}
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
            {dropdown && !isLoading && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {resultados.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">
                    {busqueda ? 'Sin resultados.' : 'No hay equipos pesados disponibles.'}
                  </div>
                ) : (
                  resultados.map(e => (
                    <button key={e.id} onMouseDown={() => handleSelect(e)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 text-left transition-colors group">
                      <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 group-hover:bg-amber-100 group-hover:text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        #{e.numeracion}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-800 block truncate">{e.descripcion}</span>
                        <div className="flex gap-3 mt-0.5">
                          {e.rentaHora != null && (
                            <span className="text-[10px] text-slate-400">{formatQ(e.rentaHora)}/hr</span>
                          )}
                          {e.rentaHoraMartillo != null && (
                            <span className="text-[10px] text-orange-500">+martillo: {formatQ(e.rentaHoraMartillo)}/hr</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuración */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={e => setFechaInicio(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Días sol. <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={diasSolicitados}
            onChange={e => { setDiasSolicitados(Math.max(1, parseInt(e.target.value) || 1)); setError(null); }}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-400 font-mono"
          />
        </div>
        {hasMartillo && (
          <label className="flex items-center gap-2 cursor-pointer select-none pb-1.5">
            <input
              type="checkbox"
              checked={conMartillo}
              onChange={e => setConMartillo(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <div>
              <span className="text-xs font-semibold text-slate-700">Con martillo</span>
              {seleccionado && (
                <span className="ml-1.5 text-[10px] text-orange-600">
                  → {formatQ(conMartillo ? seleccionado.rentaHoraMartillo! : seleccionado.rentaHora ?? 0)}/hr
                </span>
              )}
            </div>
          </label>
        )}
        <button
          onClick={handleAdd}
          disabled={!seleccionado}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar
        </button>
      </div>

      {seleccionado && (
        <p className="mt-2 text-[11px] text-slate-500">
          Tarifa efectiva: <span className="font-bold text-amber-700">{formatQ(tarifaPreview)}/hr</span>
        </p>
      )}

      {error && (
        <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function CraneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

function PagoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}

function NotasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
