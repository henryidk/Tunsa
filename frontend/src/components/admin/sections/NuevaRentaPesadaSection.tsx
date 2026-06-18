import { useState, useEffect, useMemo, useRef } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import type { Cliente } from '../../../services/clientes.service';
import type { Equipo } from '../../../types/equipo.types';
import type { ExtraSeleccionado } from '../../../types/solicitud-renta.types';
import type { ToastType } from '../../../types/ui.types';
import { equiposService } from '../../../services/equipos.service';
import { solicitudesService } from '../../../services/solicitudes.service';
import { usuariosService } from '../../../services/usuarios.service';
import { useReservadosStore } from '../../../store/reservados.store';
import { formatQ, unidadLabel } from '../../../types/solicitud.types';
import type { ModalidadPago, UnidadDuracion } from '../../../types/solicitud.types';
import EspecialBadge from '../../shared/EspecialBadge';
import PaymentModeSelector from '../../encargado/PaymentModeSelector';
import EncargadoSelector from '../../shared/EncargadoSelector';

interface Props {
  onNavTo?:     (section: string) => void;
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

interface PesadaItem {
  equipo:               Equipo;
  extrasSeleccionados:  ExtraSeleccionado[];
  tarifaBaseEfectiva:   number;
  duracion?:            number;
  unidad?:              UnidadDuracion;
  fechaInicio:          string;
}

function diasDesdeDuracion(fechaInicio: string, duracion: number, unidad: UnidadDuracion): number {
  if (unidad === 'dias')    return duracion;
  if (unidad === 'semanas') return duracion * 7;
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin    = new Date(inicio);
  fin.setMonth(fin.getMonth() + duracion);
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calcTarifa(tarifaBase: number): number {
  return tarifaBase;
}

export default function NuevaRentaPesadaSection({ onNavTo, onShowToast = () => {} }: Props) {
  const { reservedIds, setAll: setReservedIds } = useReservadosStore();

  const [allEquipos,   setAllEquipos]   = useState<Equipo[]>([]);
  const [isLoadingEqs, setIsLoadingEqs] = useState(true);
  const [equiposError, setEquiposError] = useState<string | null>(null);

  const [cliente,       setCliente]       = useState<Cliente | null>(null);
  const [clienteKey,    setClienteKey]    = useState(0);
  const [notas,         setNotas]         = useState('');
  const [items,         setItems]         = useState<PesadaItem[]>([]);
  const [indefinido,    setIndefinido]    = useState(false);
  const [modalidadPago, setModalidadPago] = useState<ModalidadPago | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [gestionadaPor, setGestionadaPor] = useState('');
  const [encargados,    setEncargados]    = useState<{ username: string; nombre: string }[]>([]);

  const [showNoEncargadoModal, setShowNoEncargadoModal] = useState(false);
  const [showNoPagoModal,      setShowNoPagoModal]      = useState(false);

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

  useEffect(() => {
    usuariosService.getEncargados().then(data => {
      setEncargados(data);
      if (data.length === 1) setGestionadaPor(data[0].username);
    }).catch(() => {});
  }, []);

  const pesadaDisponibles = useMemo(
    () => allEquipos.filter(
      e => e.isActive &&
           e.tipo.modalidad === 'PESADA' &&
           !reservedIds.has(e.id) &&
           !items.some(it => it.equipo.id === e.id),
    ),
    [allEquipos, reservedIds, items],
  );

  const handleClienteSelect = (c: Cliente | null) => {
    if (c?.id !== cliente?.id) {
      setIndefinido(false);
      setItems([]);
    }
    setCliente(c);
  };

  const handleToggleIndefinido = (val: boolean) => {
    setIndefinido(val);
    setItems([]);
  };

  const removeEquipo = (equipoId: string) =>
    setItems(prev => prev.filter(it => it.equipo.id !== equipoId));

  const updateEquipo = (updated: PesadaItem) =>
    setItems(prev => prev.map(it => (it.equipo.id === updated.equipo.id ? updated : it)));

  const handleEnviar = () => {
    if (!gestionadaPor)  { setShowNoEncargadoModal(true); return; }
    if (!modalidadPago)  { setShowNoPagoModal(true);      return; }
    void submitRenta();
  };

  const handleCancelar = () => {
    setCliente(null);
    setClienteKey(k => k + 1);
    setNotas('');
    setItems([]);
    setIndefinido(false);
    setModalidadPago(null);
    setGestionadaPor('');
  };

  const submitRenta = async () => {
    if (!cliente) return;
    setIsSubmitting(true);
    try {
      const snapItems = items.map(it => {
        if (indefinido) {
          return {
            kind:             'pesada' as const,
            equipoId:         it.equipo.id,
            numeracion:       it.equipo.numeracion,
            descripcion:      it.equipo.descripcion,
            extras:           it.extrasSeleccionados,
            tarifaBaseFijada: it.tarifaBaseEfectiva,
            fechaInicio:      it.fechaInicio,
            subtotal:         0,
          };
        }
        const dias = diasDesdeDuracion(it.fechaInicio, it.duracion!, it.unidad!);
        return {
          kind:             'pesada' as const,
          equipoId:         it.equipo.id,
          numeracion:       it.equipo.numeracion,
          descripcion:      it.equipo.descripcion,
          extras:           it.extrasSeleccionados,
          tarifaBaseFijada: it.tarifaBaseEfectiva,
          diasSolicitados:  dias,
          fechaInicio:      it.fechaInicio,
          duracion:         dias,
          unidad:           'dias' as const,
          subtotal:         0,
        };
      });

      await solicitudesService.crearRentaDirecta({
        clienteId:     cliente.id,
        gestionadaPor,
        modalidad:     modalidadPago!,
        notas:         notas.trim() || undefined,
        esIndefinida:  indefinido || undefined,
        items:         snapItems as any,
      });

      onShowToast('success', 'Renta registrada', 'La renta fue creada y está lista para ser entregada por el encargado.');
      handleCancelar();
      const reservados = await solicitudesService.getEquiposReservados();
      setReservedIds(reservados);
      onNavTo?.('rentas-solicitudes');
    } catch (err: any) {
      const msg   = err?.response?.data?.message;
      const texto = Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la renta.');
      onShowToast('error', 'Error al registrar', texto);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Renta Pesada</h1>
        <p className="text-sm text-slate-500 mt-1">
          La renta se registra aprobada directamente — el encargado solo necesita confirmar la entrega.
          Se factura por horómetro real (Q/hora); no hay total estimado.
        </p>
      </div>

      {equiposError && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {equiposError}
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-5">

          <SectionCard icon={<UserIcon />} title="Cliente de la Renta" subtitle={cliente ? 'Cliente seleccionado' : 'Busca un cliente registrado'}>
            <ClienteSearchWidget key={clienteKey} onSelect={handleClienteSelect} />
            {cliente?.esEspecial && (
              <div className="mt-3 flex items-center justify-between px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-violet-500 leading-none">∞</span>
                  <div>
                    <p className="text-xs font-semibold text-violet-700">Renta indefinida</p>
                    <p className="text-[11px] text-slate-600 leading-snug">Sin fecha de vencimiento — facturación por horómetro al devolver</p>
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

          <SectionCard
            icon={<CraneIcon />}
            title="Maquinaria Pesada"
            subtitle={indefinido ? 'Sin fecha de vencimiento · Facturación por horómetro' : 'Un equipo por renta · Facturación por horómetro'}
            locked={!cliente}
          >
            {items.length === 0 ? (
              <PesadaPickerForm
                disponibles={pesadaDisponibles}
                isLoading={isLoadingEqs}
                indefinido={indefinido}
                onAdd={item => setItems([item])}
              />
            ) : (
              <EquipoAgregado
                item={items[0]}
                indefinido={indefinido}
                onQuitar={() => removeEquipo(items[0].equipo.id)}
                onUpdateItem={updateEquipo}
              />
            )}
          </SectionCard>

          <SectionCard
            icon={<EncargadoIcon />}
            title="Encargado Asignado"
            subtitle="El encargado que gestionará la entrega y devolución de esta renta"
            locked={!cliente}
          >
            <EncargadoSelector
              value={gestionadaPor}
              onChange={setGestionadaPor}
              encargados={encargados}
            />
          </SectionCard>

          <SectionCard icon={<NotasIcon />} title="Notas / Observaciones" subtitle="Opcional — condiciones especiales o acuerdos adicionales" locked={!cliente}>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: Entregar en obra km 15, horario 7am–5pm, etc."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </SectionCard>

          <SectionCard icon={<PaymentIcon />} title="Condiciones de Pago" subtitle="Define cómo y cuándo el cliente realizará el pago" locked={!cliente}>
            <PaymentModeSelector value={modalidadPago} onChange={setModalidadPago} />
          </SectionCard>

        </div>

        {/* RIGHT */}
        <PesadaResumen
          cliente={cliente}
          items={items}
          indefinido={indefinido}
          modalidadPago={modalidadPago}
          canEnviar={!!cliente && items.length > 0 && !!gestionadaPor && !isSubmitting}
          isSubmitting={isSubmitting}
          onEnviar={handleEnviar}
          onCancelar={handleCancelar}
          canCancelar={!!cliente}
        />

      </div>

      {showNoEncargadoModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNoEncargadoModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <polyline points="16 11 18 13 22 9"/>
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
      {showNoPagoModal && (
        <SimpleModal onClose={() => setShowNoPagoModal(false)} title="Selecciona el tipo de pago" msg="Define las condiciones de pago antes de registrar la renta." variant="amber" />
      )}
    </div>
  );
}

// ── EquipoAgregado ────────────────────────────────────────────────────────────

function EquipoAgregado({ item, indefinido, onQuitar, onUpdateItem }: {
  item:         PesadaItem;
  indefinido:   boolean;
  onQuitar:     () => void;
  onUpdateItem: (item: PesadaItem) => void;
}) {
  const tarifa         = calcTarifa(item.tarifaBaseEfectiva);
  const catalogBase    = item.equipo.rentaHora ?? 0;
  const tieneOverride  = tarifa !== catalogBase;

  const [editing,     setEditing]     = useState(false);
  const [baseInput,   setBaseInput]   = useState('');
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});

  const startEdit = () => {
    setBaseInput(String(item.tarifaBaseEfectiva));
    const inputs: Record<string, string> = {};
    item.extrasSeleccionados.forEach(e => { inputs[e.tipoExtraId] = String(e.rentaHora); });
    setExtraInputs(inputs);
    setEditing(true);
  };

  const commitEdit = () => {
    const nuevaBase = parseFloat(baseInput);
    if (isNaN(nuevaBase) || nuevaBase < 0) return;
    const nuevosExtras = item.extrasSeleccionados.map(e => {
      const val = parseFloat(extraInputs[e.tipoExtraId]);
      return isNaN(val) || val < 0 ? e : { ...e, rentaHora: val };
    });
    onUpdateItem({ ...item, tarifaBaseEfectiva: nuevaBase, extrasSeleccionados: nuevosExtras });
    setEditing(false);
  };

  const restablecer = () => {
    const nuevosExtras = item.extrasSeleccionados.map(e => {
      const catalogExtra = item.equipo.extras.find(ex => ex.tipoExtraId === e.tipoExtraId);
      return catalogExtra ? { ...e, rentaHora: catalogExtra.rentaHora } : e;
    });
    onUpdateItem({ ...item, tarifaBaseEfectiva: catalogBase, extrasSeleccionados: nuevosExtras });
    setEditing(false);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Equipo</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Inicio</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Duración</th>
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Facturación</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">#{item.equipo.numeracion}</span>
                <span className="font-medium text-slate-700">{item.equipo.descripcion}</span>
              </div>
              {item.extrasSeleccionados.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Incluye: {item.extrasSeleccionados.map(e => `${e.nombre} (${formatQ(e.rentaHora)}/hr si se usa)`).join(' · ')}
                </p>
              )}
            </td>
            <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{item.fechaInicio}</td>
            <td className="px-3 py-3 whitespace-nowrap">
              {indefinido
                ? <span className="font-bold text-violet-600">∞</span>
                : <span className="text-slate-600">{unidadLabel(item.duracion!, item.unidad!)}</span>}
            </td>
            <td className="px-3 py-3 whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                {tieneOverride && (
                  <span className="text-[10px] text-slate-400 line-through">{formatQ(catalogBase)}</span>
                )}
                <span className={`font-mono font-semibold ${tieneOverride ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {formatQ(tarifa)}/hr
                </span>
              </div>
            </td>
            <td className="px-3 py-3 text-right">
              <div className="flex items-center justify-end gap-2.5">
                <button onClick={startEdit} title="Editar tarifas" className="text-slate-300 hover:text-indigo-500 transition-colors">
                  <PencilIcon />
                </button>
                <button onClick={onQuitar} className="text-slate-300 hover:text-red-400 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {editing && (
        <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Editar tarifas (Q/hora)</span>
            {tieneOverride && (
              <button onClick={restablecer} className="text-[11px] text-slate-500 hover:text-red-500 font-medium transition-colors">
                Restablecer a catálogo
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-28">
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Equipo base</label>
              <input
                type="number" min="0" step="0.01" value={baseInput}
                onChange={e => setBaseInput(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            {item.extrasSeleccionados.map(e => (
              <div key={e.tipoExtraId} className="w-28">
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 truncate" title={e.nombre}>{e.nombre}</label>
                <input
                  type="number" min="0" step="0.01" value={extraInputs[e.tipoExtraId] ?? ''}
                  onChange={ev => setExtraInputs(prev => ({ ...prev, [e.tipoExtraId]: ev.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={commitEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
              Aplicar
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">1 equipo</span>
        <span className="text-[11px] text-slate-400">Facturación por horómetro real</span>
      </div>
    </div>
  );
}

// ── PesadaResumen ─────────────────────────────────────────────────────────────

interface PesadaResumenProps {
  cliente:       Cliente | null;
  items:         PesadaItem[];
  indefinido:    boolean;
  modalidadPago: ModalidadPago | null;
  canEnviar:     boolean;
  isSubmitting:  boolean;
  onEnviar:      () => void;
  onCancelar:    () => void;
  canCancelar:   boolean;
}

function PesadaResumen({ cliente, items, indefinido, modalidadPago, canEnviar, isSubmitting, onEnviar, onCancelar, canCancelar }: PesadaResumenProps) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div className="w-72 flex-shrink-0 sticky top-20 self-start">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
            <CraneIcon />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Resumen</div>
            <div className="text-xs text-slate-500">Se registrará aprobada directamente</div>
          </div>
        </div>

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

        <div className="px-5 py-3 border-b border-slate-100 max-h-52 overflow-y-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipo asignado</div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-300">
              <CraneIcon />
              <p className="text-xs text-center">Sin equipo seleccionado</p>
            </div>
          ) : (() => {
            const it             = items[0];
            const tarifa         = calcTarifa(it.tarifaBaseEfectiva);
            const catalogBase    = it.equipo.rentaHora ?? 0;
            const tieneOverride  = tarifa !== catalogBase;
            return (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">
                    <span className="font-mono text-[10px] text-slate-400">#{it.equipo.numeracion} </span>
                    {it.equipo.descripcion}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {indefinido
                      ? <span className="text-violet-500 font-medium">∞ Tiempo indefinido</span>
                      : unidadLabel(it.duracion!, it.unidad!)}
                  </p>
                  {tieneOverride && (
                    <p className="text-[10px] text-indigo-500 font-medium mt-0.5">Tarifa personalizada</p>
                  )}
                </div>
                <span className={`text-xs font-mono font-semibold flex-shrink-0 whitespace-nowrap ${tieneOverride ? 'text-indigo-600' : 'text-amber-700'}`}>
                  {formatQ(tarifa)}/hr
                </span>
              </div>
            );
          })()}
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Pago</div>
          {!modalidadPago ? (
            <p className="text-xs text-slate-400 italic">Sin modalidad seleccionada</p>
          ) : modalidadPago === 'CONTADO' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Contado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />A crédito
            </span>
          )}
        </div>

        <div className="px-5 py-4 bg-slate-50">
          <span className="text-xs text-slate-500 font-medium">Total estimado</span>
          {indefinido ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold text-violet-600">∞</span>
              <span className="text-xs text-violet-500 font-medium leading-tight">Se calcula por horómetro al devolver</span>
            </div>
          ) : (
            <p className="text-xl font-bold text-slate-800 mt-0.5">Por horómetro</p>
          )}
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            El costo real se calcula con las lecturas diarias del horómetro.
          </p>
        </div>

        <div className="px-4 py-3 space-y-2 border-t border-slate-100">
          <button onClick={onEnviar} disabled={!canEnviar}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Registrando...</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Registrar Renta</>
            )}
          </button>
          {!confirmando ? (
            <button onClick={() => setConfirmando(true)} disabled={!canCancelar}
              className="w-full py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-500 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Cancelar
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 text-center">¿Descartar esta renta?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmando(false)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50">No</button>
                <button onClick={() => { onCancelar(); setConfirmando(false); }} className="flex-1 px-2 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium">Sí, descartar</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── PesadaPickerForm ──────────────────────────────────────────────────────────

interface PesadaPickerFormProps {
  disponibles: Equipo[];
  isLoading:   boolean;
  indefinido:  boolean;
  onAdd:       (item: PesadaItem) => void;
}

function PesadaPickerForm({ disponibles, isLoading, indefinido, onAdd }: PesadaPickerFormProps) {
  const [busqueda,            setBusqueda]            = useState('');
  const [seleccionado,        setSeleccionado]        = useState<Equipo | null>(null);
  const [dropdown,            setDropdown]            = useState(false);
  const fechaInicio = today();
  const [duracion,            setDuracion]            = useState(1);
  const [unidad,              setUnidad]              = useState<UnidadDuracion>('dias');
  const [error,               setError]               = useState<string | null>(null);
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

  const tarifaPreview = seleccionado ? calcTarifa(seleccionado.rentaHora ?? 0) : 0;

  const handleSelect = (e: Equipo) => {
    setSeleccionado(e);
    setBusqueda('');
    setDropdown(false);
    setError(null);
  };

  const handleAdd = () => {
    if (!seleccionado) { setError('Selecciona un equipo.'); return; }
    if (!indefinido && duracion < 1) { setError('La duración debe ser al menos 1.'); return; }
    const extrasSeleccionados: ExtraSeleccionado[] = seleccionado.extras.map(ex => ({
      tipoExtraId: ex.tipoExtraId,
      nombre:      ex.nombre,
      rentaHora:   ex.rentaHora,
    }));
    onAdd({
      equipo:              seleccionado,
      extrasSeleccionados,
      tarifaBaseEfectiva:  seleccionado.rentaHora ?? 0,
      duracion:            indefinido ? undefined : duracion,
      unidad:              indefinido ? undefined : unidad,
      fechaInicio,
    });
    setSeleccionado(null);
    setBusqueda('');
    setDuracion(1);
    setUnidad('dias');
    setError(null);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Agregar equipo pesado
      </div>

      {/* Buscador */}
      <div className="mb-3" ref={containerRef}>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Equipo <span className="text-red-400">*</span>
        </label>
        {seleccionado ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50">
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{seleccionado.numeracion}
            </span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{seleccionado.descripcion}</span>
            <button onClick={() => { setSeleccionado(null); setError(null); }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors">
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
            <input type="text" value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setDropdown(true); setError(null); }}
              onFocus={() => setDropdown(true)}
              placeholder={isLoading ? 'Cargando equipos...' : 'Buscar por número o descripción...'}
              disabled={isLoading}
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors group">
                      <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        #{e.numeracion}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-800 block truncate">{e.descripcion}</span>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          {e.rentaHora != null && (
                            <span className="text-[10px] text-slate-400">{formatQ(e.rentaHora)}/hr</span>
                          )}
                          {e.extras.map(ex => (
                            <span key={ex.tipoExtraId} className="text-[10px] text-orange-500">
                              +{ex.nombre}: {formatQ(ex.rentaHora)}/hr
                            </span>
                          ))}
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

      {/* Extras del equipo seleccionado — informativo, viajan siempre con la máquina */}
      {seleccionado && seleccionado.extras.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Complementos incluidos</p>
          {seleccionado.extras.map(ex => (
            <div key={ex.tipoExtraId} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">{ex.nombre}</span>
              <span className="text-[10px] text-slate-400">— {formatQ(ex.rentaHora)}/hr si se usa</span>
            </div>
          ))}
        </div>
      )}

      {/* Fecha inicio + duración (duración oculta en modo indefinido) */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha inicio</label>
          <div className="border border-slate-200 rounded-lg px-2.5 py-2.5 text-xs bg-slate-50 flex items-center gap-2 select-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="font-mono text-slate-500">{fechaInicio}</span>
            <span className="text-[10px] text-slate-400 font-medium">Hoy</span>
          </div>
        </div>
        {!indefinido && (
          <>
            <div className="w-20">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Duración <span className="text-red-400">*</span>
              </label>
              <input type="number" min="1" value={duracion}
                onChange={e => { setDuracion(Math.max(1, parseInt(e.target.value) || 1)); setError(null); }}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono" />
            </div>
            <div className="w-28">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unidad</label>
              <select value={unidad} onChange={e => { setUnidad(e.target.value as UnidadDuracion); setError(null); }}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="dias">días</option>
                <option value="semanas">semanas</option>
                <option value="meses">meses</option>
              </select>
            </div>
          </>
        )}
        <button onClick={handleAdd} disabled={!seleccionado}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar
        </button>
      </div>

      {seleccionado && (
        <p className="mt-2 text-[11px] text-slate-500">
          Tarifa efectiva: <span className="font-bold text-slate-700 font-mono">{formatQ(tarifaPreview)}/hr</span>
          {indefinido && <span className="ml-2 text-violet-500 font-medium">· Sin fecha límite</span>}
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

// ── Layout helpers ────────────────────────────────────────────────────────────

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
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <div className="relative">
        <div className={`px-5 py-5${locked ? ' select-none pointer-events-none opacity-40' : ''}`}>{children}</div>
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

interface SimpleModalProps { onClose: () => void; title: string; msg: string; variant: 'red' | 'amber'; }

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

function UserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}

function CraneIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
}

function NotasIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}

function PaymentIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
}

function EncargadoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>;
}

function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
