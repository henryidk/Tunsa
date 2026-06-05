import { useState, useEffect, useMemo, useRef } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import type { Cliente } from '../../../services/clientes.service';
import type { Equipo } from '../../../types/equipo.types';
import type { ExtraSeleccionado } from '../../../types/solicitud-renta.types';
import type { ToastType } from '../../../types/ui.types';
import { equiposService } from '../../../services/equipos.service';
import { solicitudesService } from '../../../services/solicitudes.service';
import { usePendientesStore } from '../../../store/pendientes.store';
import { useReservadosStore } from '../../../store/reservados.store';
import { formatQ, unidadLabel } from '../../../types/solicitud.types';
import type { UnidadDuracion } from '../../../types/solicitud.types';
import EspecialBadge from '../../shared/EspecialBadge';

interface Props {
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
}

interface PesadaItem {
  equipo:              Equipo;
  extrasSeleccionados: ExtraSeleccionado[];
  duracion?:           number;
  unidad?:             UnidadDuracion;
  fechaInicio:         string;
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

function calcTarifa(equipo: Equipo, extras: ExtraSeleccionado[]): number {
  const base      = equipo.rentaHora ?? 0;
  const extrasSum = extras.reduce((s, e) => s + e.rentaHora, 0);
  return base + extrasSum;
}

export default function NuevaSolicitudPesadaSection({ onShowToast = () => {} }: Props) {
  const addPendiente = usePendientesStore(s => s.addSolicitud);
  const { reservedIds, setAll: setReservedIds } = useReservadosStore();

  const [allEquipos,   setAllEquipos]   = useState<Equipo[]>([]);
  const [isLoadingEqs, setIsLoadingEqs] = useState(true);
  const [equiposError, setEquiposError] = useState<string | null>(null);

  const [cliente,      setCliente]      = useState<Cliente | null>(null);
  const [clienteKey,   setClienteKey]   = useState(0);
  const [notas,        setNotas]        = useState('');
  const [items,        setItems]        = useState<PesadaItem[]>([]);
  const [indefinido,   setIndefinido]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleEnviar = () => {
    if (!notas.trim()) { setShowNoNotasModal(true); return; }
    void submitSolicitud();
  };

  const submitSolicitud = async () => {
    if (!cliente) return;
    setShowNoNotasModal(false);
    setIsSubmitting(true);
    try {
      const snapItems = items.map(it => {
        if (indefinido) {
          return {
            kind:        'pesada' as const,
            equipoId:    it.equipo.id,
            numeracion:  it.equipo.numeracion,
            descripcion: it.equipo.descripcion,
            extras:      it.extrasSeleccionados,
            fechaInicio: it.fechaInicio,
            subtotal:    0,
          };
        }
        const dias = diasDesdeDuracion(it.fechaInicio, it.duracion!, it.unidad!);
        return {
          kind:            'pesada' as const,
          equipoId:        it.equipo.id,
          numeracion:      it.equipo.numeracion,
          descripcion:     it.equipo.descripcion,
          extras:          it.extrasSeleccionados,
          diasSolicitados: dias,
          fechaInicio:     it.fechaInicio,
          duracion:        dias,
          unidad:          'dias' as const,
          subtotal:        0,
        };
      });

      const nueva = await solicitudesService.create({
        clienteId:   cliente.id,
        modalidad:   'CONTADO',
        notas:       notas.trim(),
        esIndefinida: indefinido || undefined,
        items:       snapItems as any,
      });

      addPendiente(nueva);
      onShowToast('success', 'Solicitud enviada', 'La solicitud fue registrada y notificada correctamente.');
      setCliente(null);
      setClienteKey(k => k + 1);
      setNotas('');
      setItems([]);
      setIndefinido(false);
      const reservados = await solicitudesService.getEquiposReservados();
      setReservedIds(reservados);
    } catch (err: any) {
      const msg   = err?.response?.data?.message;
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

        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-5">

          <SectionCard icon={<UserIcon />} title="Cliente de la Solicitud" subtitle={cliente ? 'Cliente seleccionado' : 'Busca un cliente registrado'}>
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
            subtitle={indefinido ? 'Sin fecha de vencimiento · Facturación por horómetro' : 'Un equipo por solicitud · Facturación por horómetro'}
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
              />
            )}
          </SectionCard>

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

        {/* RIGHT */}
        <PesadaResumen
          cliente={cliente}
          items={items}
          indefinido={indefinido}
          canEnviar={!!cliente && items.length > 0 && !isSubmitting}
          isSubmitting={isSubmitting}
          onEnviar={handleEnviar}
          onCancelar={() => {
            setCliente(null); setClienteKey(k => k + 1);
            setNotas(''); setItems([]); setIndefinido(false);
          }}
          canCancelar={!!cliente}
        />

      </div>

      {showNoNotasModal && (
        <SimpleModal onClose={() => setShowNoNotasModal(false)} title="Observaciones requeridas" msg="Agrega una nota antes de continuar." variant="red" />
      )}
    </div>
  );
}

// ── EquipoAgregado ────────────────────────────────────────────────────────────

function EquipoAgregado({ item, indefinido, onQuitar }: { item: PesadaItem; indefinido: boolean; onQuitar: () => void }) {
  const tarifa = calcTarifa(item.equipo, item.extrasSeleccionados);
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
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {item.extrasSeleccionados.map(e => `+ ${e.nombre}`).join(' · ')}
                </p>
              )}
            </td>
            <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{item.fechaInicio}</td>
            <td className="px-3 py-3 whitespace-nowrap">
              {indefinido
                ? <span className="font-bold text-violet-600">∞</span>
                : <span className="text-slate-600">{unidadLabel(item.duracion!, item.unidad!)}</span>}
            </td>
            <td className="px-3 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">{formatQ(tarifa)}/hr</td>
            <td className="px-3 py-3 text-right">
              <button onClick={onQuitar} className="text-slate-300 hover:text-red-400 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">1 equipo</span>
        <span className="text-[11px] text-slate-400">Facturación por horómetro real</span>
      </div>
    </div>
  );
}

// ── PesadaResumen ─────────────────────────────────────────────────────────────

interface PesadaResumenProps {
  cliente:      Cliente | null;
  items:        PesadaItem[];
  indefinido:   boolean;
  canEnviar:    boolean;
  isSubmitting: boolean;
  onEnviar:     () => void;
  onCancelar:   () => void;
  canCancelar:  boolean;
}

function PesadaResumen({ cliente, items, indefinido, canEnviar, isSubmitting, onEnviar, onCancelar, canCancelar }: PesadaResumenProps) {
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
            <div className="text-xs text-slate-500">Facturación por horómetro</div>
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
            const it     = items[0];
            const tarifa = calcTarifa(it.equipo, it.extrasSeleccionados);
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
                      : <>{unidadLabel(it.duracion!, it.unidad!)}{it.extrasSeleccionados.map(e => ` · ${e.nombre}`)}</>}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-amber-700 flex-shrink-0 whitespace-nowrap">
                  {formatQ(tarifa)}/hr
                </span>
              </div>
            );
          })()}
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
              <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Enviando...</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>Enviar Solicitud</>
            )}
          </button>
          {!confirmando ? (
            <button onClick={() => setConfirmando(true)} disabled={!canCancelar}
              className="w-full py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-500 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Cancelar solicitud
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 text-center">¿Cancelar todo?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmando(false)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50">No</button>
                <button onClick={() => { onCancelar(); setConfirmando(false); }} className="flex-1 px-2 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium">Sí, cancelar</button>
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
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<ExtraSeleccionado[]>([]);
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

  const tarifaPreview = seleccionado ? calcTarifa(seleccionado, extrasSeleccionados) : 0;

  const handleSelect = (e: Equipo) => {
    setSeleccionado(e);
    setExtrasSeleccionados([]);
    setBusqueda('');
    setDropdown(false);
    setError(null);
  };

  const toggleExtrapicker = (extra: ExtraSeleccionado) => {
    setExtrasSeleccionados(prev => {
      const existe = prev.some(e => e.tipoExtraId === extra.tipoExtraId);
      return existe ? prev.filter(e => e.tipoExtraId !== extra.tipoExtraId) : [...prev, extra];
    });
  };

  const handleAdd = () => {
    if (!seleccionado) { setError('Selecciona un equipo.'); return; }
    if (!indefinido && duracion < 1) { setError('La duración debe ser al menos 1.'); return; }
    onAdd({
      equipo:              seleccionado,
      extrasSeleccionados,
      duracion:            indefinido ? undefined : duracion,
      unidad:              indefinido ? undefined : unidad,
      fechaInicio,
    });
    setSeleccionado(null);
    setExtrasSeleccionados([]);
    setBusqueda('');
    setDuracion(1);
    setUnidad('dias');
    setFechaInicio(today());
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
            <button onClick={() => { setSeleccionado(null); setExtrasSeleccionados([]); setError(null); }}
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

      {/* Extras del equipo seleccionado */}
      {seleccionado && seleccionado.extras.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Complementos disponibles</p>
          {seleccionado.extras.map(ex => {
            const activo = extrasSeleccionados.some(e => e.tipoExtraId === ex.tipoExtraId);
            return (
              <label key={ex.tipoExtraId} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={activo}
                  onChange={() => toggleExtrapicker({ tipoExtraId: ex.tipoExtraId, nombre: ex.nombre, rentaHora: ex.rentaHora })}
                  className="w-3.5 h-3.5 accent-orange-500" />
                <span className="text-xs font-medium text-slate-700">{ex.nombre}</span>
                <span className="text-[10px] text-orange-600">+{formatQ(ex.rentaHora)}/hr</span>
              </label>
            );
          })}
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
