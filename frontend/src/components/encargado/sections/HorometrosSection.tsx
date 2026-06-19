import { useState, useEffect, useCallback, Fragment } from 'react';
import type { AxiosError } from 'axios';
import { solicitudesService, type LecturaHorometro, type DashboardStats } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot, ExtraSeleccionado } from '../../../types/solicitud-renta.types';
import { formatQ } from '../../../types/solicitud.types';
import {
  today, getDiaStatus, tieneComplementoMixto,
  formatFechaCorta, localDateOf, ultimoDiaHorometro, validarInicioHorometro, diasPendientesAnteriores,
} from '../../../utils/horometro.utils';
import HorometroRentaCard from '../HorometroRentaCard';
import CalendarioMes from '../CalendarioMes';
import { useActivasStore, useAdminActivasStore } from '../../../store/activas.store';
import { useVencidasStore, useAdminVencidasStore } from '../../../store/vencidas.store';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

const RECARGO_NOCTURNO = 100; // Q extra por hora nocturna — mismo valor que backend/horometro-calc.service.ts
const fmtHorometro = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 1 });

function getApiErrorMessage(err: unknown): string | string[] | undefined {
  return (err as AxiosError<{ message?: string | string[] }>)?.response?.data?.message;
}

// Fetch por defecto: solo las rentas del encargado autenticado.
// Definido a nivel de módulo para que sea estable como dependencia de useEffect.
const fetchSolicitudesEncargado = () =>
  Promise.all([
    solicitudesService.getActivasMias(),
    solicitudesService.getVencidasMias(),
  ]).then(([activas, vencidas]) => [...activas, ...vencidas].filter(s => s.esPesada));

export interface HorometrosSectionProps {
  initialSolicitudId?: string;
  fetchSolicitudes?:   () => Promise<SolicitudRenta[]>;
  onNavTo?:            (section: string, state?: { solicitudId?: string; folio?: string }) => void;
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export default function HorometrosSection({ initialSolicitudId, fetchSolicitudes, onNavTo }: HorometrosSectionProps) {
  const hoy = today();
  const [solicitudes,   setSolicitudes]   = useState<SolicitudRenta[]>([]);
  const [lecturasMap,   setLecturasMap]   = useState<Record<string, LecturaHorometro[]>>({});
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError,     setListError]     = useState<string | null>(null);
  const [busqueda,      setBusqueda]      = useState('');

  // Detail view state
  const [selectedId,  setSelectedId]  = useState<string | null>(initialSolicitudId ?? null);
  const [activeEquipo, setActiveEquipo] = useState<string>('');
  const [mesActivo,    setMesActivo]   = useState({
    año: new Date().getFullYear(),
    mes: new Date().getMonth(),
  });
  const [fechaActiva,  setFechaActiva] = useState(hoy);

  // Form state
  const [valor,        setValor]       = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    tipo:         'inicio' | 'fin5pm' | 'tramo';
    valorNum:     number;
    fecha:        string;
    extraId?:     string | null;
    extraNombre?: string | null;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{ titulo: string; mensaje: string } | null>(null);

  // Tramo (cambio de complemento intradía) form state
  const [formTab,        setFormTab]        = useState<'cierre' | 'cambio'>('cierre');
  const [tramoValor,    setTramoValor]    = useState('');
  const [tramoExtraId,  setTramoExtraId]  = useState<string | null>(null);
  const [tramoError,    setTramoError]    = useState<string | null>(null);
  const [isUndoingTramo, setIsUndoingTramo] = useState(false);
  const [expandedMixto, setExpandedMixto] = useState<string | null>(null);

  // Complemento inicial del día (solo aplica al registrar el horómetro de inicio de un día nuevo)
  const [inicioExtraId, setInicioExtraId] = useState<string | null>(null);

  // Tramos de la noche anterior (cuando el inicio de hoy implica horas nocturnas) — se construyen
  // en el cliente y se envían junto con el horómetro de inicio, sin llamadas intermedias al servidor.
  const [cortesNocturnos, setCortesNocturnos] = useState<{ horometroCorte: number; extraId: string | null }[]>([]);
  const [corteFormOpen,   setCorteFormOpen]   = useState(false);
  const [corteValor,      setCorteValor]      = useState('');
  const [corteExtraId,    setCorteExtraId]    = useState<string | null>(null);
  const [corteError,      setCorteError]      = useState<string | null>(null);

  const resetTramoForm = () => {
    setFormTab('cierre'); setTramoValor(''); setTramoExtraId(null); setTramoError(null);
    setCortesNocturnos([]); setCorteFormOpen(false); setCorteValor(''); setCorteExtraId(null); setCorteError(null);
  };

  const resolvedFetch  = fetchSolicitudes ?? fetchSolicitudesEncargado;
  const modoEncargado  = fetchSolicitudes == null;

  const [pesadaStats,        setPesadaStats]        = useState<Pick<DashboardStats, 'pesadaRecaudadaMes'> | null>(null);
  const [loadingPesadaStats, setLoadingPesadaStats] = useState(modoEncargado);

  useEffect(() => {
    if (!modoEncargado) return;
    solicitudesService.getDashboardStats()
      .then(s => setPesadaStats({ pesadaRecaudadaMes: s.pesadaRecaudadaMes }))
      .catch(() => setPesadaStats({ pesadaRecaudadaMes: 0 }))
      .finally(() => setLoadingPesadaStats(false));
  // Solo se ejecuta al montar en modo encargado
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all pesada rentals (activas + vencidas, para poder registrar horómetros antes de devolver)
  useEffect(() => {
    resolvedFetch()
      .then(setSolicitudes)
      .catch(() => setListError('No se pudieron cargar las rentas pesadas.'))
      .finally(() => setIsLoadingList(false));
  }, [resolvedFetch]);

  // Load lecturas for all rentals in parallel once list is ready
  useEffect(() => {
    if (solicitudes.length === 0) return;
    Promise.all(
      solicitudes.map(s =>
        solicitudesService.getLecturas(s.id).then(l => [s.id, l] as const),
      ),
    ).then(entries => setLecturasMap(Object.fromEntries(entries)));
  }, [solicitudes]);

  // Respond to initialSolicitudId prop changes (when navTo is called while section is already active)
  useEffect(() => {
    if (initialSolicitudId) setSelectedId(initialSolicitudId);
  }, [initialSolicitudId]);

  // Initialize detail state when a rental is selected
  useEffect(() => {
    if (!selectedId) return;
    const sol = solicitudes.find(s => s.id === selectedId);
    if (!sol) return;
    const items = (sol.items as ItemSnapshot[]).filter((i): i is PesadaItem => i.kind === 'pesada');
    setActiveEquipo(items[0]?.equipoId ?? '');
    setMesActivo({ año: new Date().getFullYear(), mes: new Date().getMonth() });
    setFechaActiva(today());
    setValor('');
    setSubmitError(null);
    resetTramoForm();
  }, [selectedId, solicitudes]);

  const refreshLecturas = useCallback(async (solicitudId: string): Promise<LecturaHorometro[]> => {
    const l = await solicitudesService.getLecturas(solicitudId);
    setLecturasMap(prev => ({ ...prev, [solicitudId]: l }));
    return l;
  }, []);

  // ── Detail-view derived data ──────────────────────────────────────────────────
  const selectedSol  = selectedId ? solicitudes.find(s => s.id === selectedId) ?? null : null;
  const pesadaItems  = selectedSol
    ? (selectedSol.items as ItemSnapshot[]).filter((i): i is PesadaItem => i.kind === 'pesada')
    : [];
  const activeItem     = pesadaItems.find(i => i.equipoId === activeEquipo) ?? null;
  const lecturasAll    = selectedId ? (lecturasMap[selectedId] ?? null) : null;
  const lecturasEquipo = lecturasAll?.filter(l => l.equipoId === activeEquipo) ?? null;

  const fechaInicioStr = selectedSol?.fechaInicioRenta
    ? localDateOf(new Date(selectedSol.fechaInicioRenta))
    : hoy;

  const limiteRegistro = ultimoDiaHorometro(selectedSol?.fechaFinEstimada);

  // Month navigation constraints
  const minMes = {
    año: parseInt(fechaInicioStr.substring(0, 4)),
    mes: parseInt(fechaInicioStr.substring(5, 7)) - 1,
  };
  const maxMes = {
    año: parseInt(limiteRegistro.substring(0, 4)),
    mes: parseInt(limiteRegistro.substring(5, 7)) - 1,
  };
  const canPrev = mesActivo.año > minMes.año || (mesActivo.año === minMes.año && mesActivo.mes > minMes.mes);
  const canNext = mesActivo.año < maxMes.año || (mesActivo.año === maxMes.año && mesActivo.mes < maxMes.mes);

  const navMes = (dir: -1 | 1) => {
    setMesActivo(prev => {
      let { año, mes } = prev;
      mes += dir;
      if (mes < 0)  { mes = 11; año--; }
      if (mes > 11) { mes = 0;  año++; }
      return { año, mes };
    });
  };

  // Lecturas filtered to the active month
  const lecturasDelMes = (lecturasEquipo ?? []).filter(l => {
    const lAño = parseInt(l.fecha.substring(0, 4));
    const lMes = parseInt(l.fecha.substring(5, 7)) - 1;
    return lAño === mesActivo.año && lMes === mesActivo.mes;
  });

  // Days in active month within rental period and not future (for month stats)
  const diasDelMes = (() => {
    if (!selectedSol) return [];
    const { año, mes } = mesActivo;
    const mm = String(mes + 1).padStart(2, '0');
    const diasEnMes = new Date(año, mes + 1, 0).getDate();
    const result: string[] = [];
    for (let d = 1; d <= diasEnMes; d++) {
      const dd   = String(d).padStart(2, '0');
      const date = `${año}-${mm}-${dd}`;
      if (date < fechaInicioStr || date > limiteRegistro) continue;
      result.push(date);
    }
    return result;
  })();

  const diasCompletos    = lecturasEquipo ? diasDelMes.filter(d => getDiaStatus(lecturasEquipo, d) === 'completo').length  : 0;
  const diasParciales    = lecturasEquipo ? diasDelMes.filter(d => getDiaStatus(lecturasEquipo, d) === 'parcial').length   : 0;
  const diasSinRegistro  = lecturasEquipo ? diasDelMes.filter(d => getDiaStatus(lecturasEquipo, d) === 'sin-registro').length : 0;

  // Form derived data
  const lecturaFecha   = lecturasEquipo?.find(l => l.fecha === fechaActiva) ?? null;
  const tipoPendiente: 'inicio' | 'fin5pm' | null = (() => {
    if (!lecturaFecha)                        return 'inicio';
    if (lecturaFecha.horometroFin5pm === null) return 'fin5pm';
    return null;
  })();

  // Complemento con el que cerró el día anterior — default sugerido al registrar el inicio de un día nuevo
  const diaAnteriorCerrado = lecturasEquipo
    ?.filter(l => l.fecha < fechaActiva && l.horometroFin5pm != null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
  const complementoHeredadoId     = diaAnteriorCerrado?.complementoActivoId ?? null;
  const complementoHeredadoNombre = diaAnteriorCerrado?.complementoActivoNombre ?? null;

  useEffect(() => {
    if (tipoPendiente === 'inicio') setInicioExtraId(complementoHeredadoId);
  }, [activeEquipo, fechaActiva, tipoPendiente, complementoHeredadoId]);

  // Detección en vivo de horas nocturnas: si lo que se está escribiendo como horómetro de inicio
  // es mayor al cierre de ayer, hubo horas nocturnas que el usuario puede dividir en tramos.
  const finAnteriorNum  = diaAnteriorCerrado?.horometroFin5pm ?? null;
  const valorInicioNum  = tipoPendiente === 'inicio' ? parseFloat(valor) : NaN;
  const horasNocturnasDetectadas = (finAnteriorNum != null && !isNaN(valorInicioNum))
    ? valorInicioNum - finAnteriorNum
    : 0;

  // Quita de la lista los cortes que dejaron de tener sentido (ej. el usuario bajó el horómetro escrito)
  useEffect(() => {
    if (finAnteriorNum == null || isNaN(valorInicioNum)) return;
    setCortesNocturnos(cs => cs.filter(c => c.horometroCorte > finAnteriorNum && c.horometroCorte < valorInicioNum));
  }, [finAnteriorNum, valorInicioNum]);

  // Segmentos de la noche anterior, construidos a partir de los cortes agregados — mismo cálculo que hace el backend.
  const segmentosNocturnos = (() => {
    if (horasNocturnasDetectadas <= 0 || finAnteriorNum == null || !activeItem) return [];
    const puntos  = [...cortesNocturnos].sort((a, b) => a.horometroCorte - b.horometroCorte);
    const bordes  = [finAnteriorNum, ...puntos.map(c => c.horometroCorte), valorInicioNum];
    const activos = [complementoHeredadoId, ...puntos.map(c => c.extraId)];
    return activos.map((extraId, i) => {
      const desde   = bordes[i];
      const hasta   = bordes[i + 1];
      const horas   = Math.max(0, hasta - desde);
      const extra   = extraId ? activeItem.extras.find(ex => ex.tipoExtraId === extraId) : undefined;
      const tarifa  = activeItem.tarifaEfectiva + (extra?.rentaHora ?? 0) + RECARGO_NOCTURNO;
      return { desde, hasta, extraId, extraNombre: extra?.nombre ?? null, horas, costo: horas * tarifa };
    });
  })();

  const handleAgregarCorte = () => {
    if (finAnteriorNum == null) return;
    const v = parseFloat(corteValor);
    if (isNaN(v)) { setCorteError('Ingresa un horómetro válido.'); return; }
    if (v <= finAnteriorNum || v >= valorInicioNum) {
      setCorteError(`El punto de corte debe estar entre ${fmtHorometro(finAnteriorNum)} y ${fmtHorometro(valorInicioNum)} hrs.`);
      return;
    }
    if (cortesNocturnos.some(c => c.horometroCorte === v)) {
      setCorteError('Ya existe un punto de corte con ese horómetro.');
      return;
    }
    const ultimoActivo = cortesNocturnos.length > 0
      ? [...cortesNocturnos].sort((a, b) => a.horometroCorte - b.horometroCorte).find(c => c.horometroCorte < v)?.extraId ?? complementoHeredadoId
      : complementoHeredadoId;
    if (corteExtraId === ultimoActivo) {
      setCorteError('Selecciona un complemento distinto al del tramo anterior.');
      return;
    }
    setCortesNocturnos(cs => [...cs, { horometroCorte: v, extraId: corteExtraId }].sort((a, b) => a.horometroCorte - b.horometroCorte));
    setCorteValor(''); setCorteExtraId(null); setCorteError(null); setCorteFormOpen(false);
  };

  const handleSelectDia = (d: string) => { setFechaActiva(d); setValor(''); setSubmitError(null); resetTramoForm(); };

  // Valida y abre el modal de confirmación
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoPendiente || !selectedId) return;
    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 0) {
      setSubmitError('El valor del horómetro debe ser un número válido mayor o igual a 0.');
      return;
    }
    if (tipoPendiente === 'fin5pm' && lecturaFecha?.horometroInicio != null && valorNum < lecturaFecha.horometroInicio) {
      setSubmitError('El horómetro de cierre no puede ser menor al de inicio.');
      return;
    }
    if (tipoPendiente === 'inicio') {
      const pendientes = diasPendientesAnteriores(fechaActiva, fechaInicioStr, lecturasEquipo);
      if (pendientes.length > 0) {
        const listadas = pendientes.slice(0, 3).map(formatFechaCorta).join(', ');
        const resto    = pendientes.length > 3 ? ` y ${pendientes.length - 3} más` : '';
        setErrorModal({
          titulo:  'Días pendientes',
          mensaje: `No puedes registrar esta fecha mientras haya días sin completar. Pendientes: ${listadas}${resto}.`,
        });
        return;
      }
      const error = validarInicioHorometro(valorNum, lecturasEquipo?.length === 0, activeItem?.horometroInicial, lecturasEquipo, fechaActiva);
      if (error) { setErrorModal(error); return; }
    }
    setSubmitError(null);
    if (tipoPendiente === 'inicio' && activeItem && activeItem.extras.length > 0) {
      const extraNombre = inicioExtraId
        ? activeItem.extras.find(ex => ex.tipoExtraId === inicioExtraId)?.nombre ?? null
        : null;
      setPendingConfirm({ tipo: tipoPendiente, valorNum, fecha: fechaActiva, extraId: inicioExtraId, extraNombre });
      return;
    }
    setPendingConfirm({ tipo: tipoPendiente, valorNum, fecha: fechaActiva });
  };

  // Valida y abre el modal de confirmación para un cambio de complemento intradía
  const handleSubmitTramo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !lecturaFecha || lecturaFecha.horometroInicio == null) return;
    const valorNum = parseFloat(tramoValor);
    if (isNaN(valorNum) || valorNum < 0) {
      setTramoError('El valor del horómetro debe ser un número válido mayor o igual a 0.');
      return;
    }
    const ultimaReferencia = lecturaFecha.tramos.length > 0
      ? lecturaFecha.tramos[lecturaFecha.tramos.length - 1].horometroHasta
      : lecturaFecha.horometroInicio;
    if (valorNum <= ultimaReferencia) {
      setTramoError(`El horómetro debe ser mayor al último registrado en el día (${ultimaReferencia} hrs).`);
      return;
    }
    const activoActual = lecturaFecha.complementoActivoId ?? null;
    if (tramoExtraId === activoActual) {
      setTramoError('Selecciona un complemento distinto al estado actual.');
      return;
    }
    setTramoError(null);
    const extraNombre = tramoExtraId
      ? activeItem?.extras.find(ex => ex.tipoExtraId === tramoExtraId)?.nombre ?? null
      : null;
    setPendingConfirm({ tipo: 'tramo', valorNum, fecha: fechaActiva, extraId: tramoExtraId, extraNombre });
  };

  const handleDeshacerTramo = async () => {
    if (!selectedId) return;
    setIsUndoingTramo(true);
    setTramoError(null);
    try {
      await solicitudesService.deshacerUltimoTramo(selectedId, { equipoId: activeEquipo, fecha: fechaActiva });
      await refreshLecturas(selectedId);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setTramoError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo deshacer el cambio.'));
    } finally {
      setIsUndoingTramo(false);
    }
  };

  // Ejecuta el envío real tras confirmar en el modal
  const confirmarLectura = async () => {
    if (!pendingConfirm || !selectedId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const confirm = pendingConfirm;
    setPendingConfirm(null);
    try {
      if (confirm.tipo === 'tramo') {
        await solicitudesService.registrarTramo(selectedId, {
          equipoId:  activeEquipo,
          fecha:     confirm.fecha,
          horometro: confirm.valorNum,
          extraId:   confirm.extraId ?? null,
        });
        resetTramoForm();
      } else {
        await solicitudesService.registrarLectura(selectedId, {
          equipoId: activeEquipo,
          fecha:    confirm.fecha,
          tipo:     confirm.tipo,
          valor:    confirm.valorNum,
          ...(confirm.tipo === 'inicio' && confirm.extraId !== undefined ? { extraId: confirm.extraId } : {}),
          ...(confirm.tipo === 'inicio' && cortesNocturnos.length > 0 ? { tramosNocturnos: cortesNocturnos } : {}),
        });
        setValor('');
        resetTramoForm();
      }
      const freshLecturas = await refreshLecturas(selectedId);

      // Sync ultimaLectura in all stores so vencidas/activas cards reflect the new state
      const sorted = [...freshLecturas].sort((a, b) => b.fecha.localeCompare(a.fecha));
      const latest = sorted[0] ?? null;
      const newUltimaLectura = latest
        ? { fecha: latest.fecha, completa: latest.horometroFin5pm !== null }
        : null;
      for (const store of [useActivasStore, useAdminActivasStore, useVencidasStore, useAdminVencidasStore]) {
        const sol = store.getState().solicitudes.find(s => s.id === selectedId);
        if (sol) store.getState().updateRenta({ ...sol, ultimaLectura: newUltimaLectura });
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setSubmitError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la lectura.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pending-today count for list-view banner.
  // Una renta no cuenta como pendiente si hoy ya pasó su límite de registro.
  const pendientesHoy = solicitudes.filter(s => {
    if (hoy > ultimoDiaHorometro(s.fechaFinEstimada)) return false;
    const lecturas = lecturasMap[s.id];
    if (lecturas !== undefined) {
      const hoyLectura = lecturas.find(l => l.fecha === hoy);
      return !hoyLectura || hoyLectura.horometroInicio === null || hoyLectura.horometroFin5pm === null;
    }
    const ul = s.ultimaLectura;
    return !ul || ul.fecha !== hoy || !ul.completa;
  }).length;

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (selectedSol) {
    const isFirstMonth = mesActivo.año === minMes.año && mesActivo.mes === minMes.mes;

    return (
      <div>
        {/* Back bar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setSelectedId(null); setValor(''); setSubmitError(null); }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-800">{selectedSol.folio}</span>
          <span className="text-sm text-slate-500">{selectedSol.cliente.nombre}</span>
        </div>

        {/* Equipment tabs (only when multiple equipos) */}
        {pesadaItems.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {pesadaItems.map(item => (
              <button
                key={item.equipoId}
                onClick={() => { setActiveEquipo(item.equipoId); setValor(''); setFechaActiva(hoy); setSubmitError(null); resetTramoForm(); }}
                className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  activeEquipo === item.equipoId
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-slate-400 mr-1">#{item.numeracion}</span>
                {item.descripcion}
              </button>
            ))}
          </div>
        )}

        {/* Equipo info bar */}
        {activeItem && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <InfoTile
              label="Equipo"
              value={<><span className="font-mono text-slate-400 mr-1">#{activeItem.numeracion}</span>{activeItem.descripcion}</>}
              icon={<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
              color="slate"
            />
            {activeItem.horometroInicial != null && (
              <InfoTile
                label="Entrega al cliente"
                value={`${activeItem.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })} hrs`}
                icon={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                color="amber"
              />
            )}
            <InfoTile
              label="Tarifa"
              value={`${formatQ(activeItem.tarifaEfectiva)}/hr`}
              icon={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>}
              color="emerald"
            />
            <InfoTile
              label="Inicio de renta"
              value={fechaInicioStr.split('-').reverse().join('/')}
              icon={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}
              color="slate"
            />
            {selectedSol.fechaFinEstimada && (
              <InfoTile
                label="Fin estimado"
                value={selectedSol.fechaFinEstimada.substring(0, 10).split('-').reverse().join('/')}
                icon={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}
                color={new Date(selectedSol.fechaFinEstimada) < new Date() ? 'red' : 'slate'}
              />
            )}
          </div>
        )}

        {/* Two-column layout: calendar left, form + table right */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* Calendar column */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navMes(-1)}
                disabled={!canPrev}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <span className="text-sm font-bold text-slate-700">
                {MESES[mesActivo.mes]} {mesActivo.año}
              </span>
              <button
                onClick={() => navMes(1)}
                disabled={!canNext}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            {lecturasEquipo !== null ? (
              <CalendarioMes
                año={mesActivo.año}
                mes={mesActivo.mes}
                lecturas={lecturasEquipo}
                fechaInicioRenta={fechaInicioStr}
                limiteRegistro={limiteRegistro}
                fechaActiva={fechaActiva}
                onSelectDia={handleSelectDia}
              />
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array(35).fill(0).map((_, i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {/* Month summary */}
            {lecturasEquipo !== null && diasDelMes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-emerald-700">{diasCompletos}</p>
                  <p className="text-xs text-slate-400">Completos</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600">{diasParciales}</p>
                  <p className="text-xs text-slate-400">Solo inicio</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">{diasSinRegistro}</p>
                  <p className="text-xs text-slate-400">Sin registro</p>
                </div>
              </div>
            )}
          </div>

          {/* Right column: registration form + monthly lecturas table */}
          <div className="space-y-5">

            {/* Registration form */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-700">Registrar lectura</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500">Fecha</label>
                  <input
                    type="date"
                    value={fechaActiva}
                    onChange={e => handleSelectDia(e.target.value)}
                    max={limiteRegistro}
                    min={fechaInicioStr}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                {formatFechaCorta(fechaActiva)}
                {fechaActiva === hoy && ' · hoy'}
              </p>

              {fechaActiva > limiteRegistro ? (
                <p className="text-xs text-slate-400 italic">No se pueden registrar lecturas de fechas futuras.</p>
              ) : fechaActiva < fechaInicioStr ? (
                <p className="text-xs text-slate-400 italic">Fecha anterior al inicio de la renta.</p>
              ) : tipoPendiente === null && valor !== 'corregir' ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">Día completo — inicio y cierre registrados.</p>
                  <button
                    type="button"
                    onClick={() => setValor('corregir')}
                    className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    Corregir
                  </button>
                </div>
              ) : valor === 'corregir' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <CorregirInput
                      label="Horómetro de inicio"
                      defaultValue={lecturaFecha?.horometroInicio ?? undefined}
                      onConfirm={async v => {
                        if (!selectedId) return;
                        const isFirstReading = !lecturasEquipo?.some(l => l.fecha < fechaActiva);
                        const error = validarInicioHorometro(v, isFirstReading, activeItem?.horometroInicial, lecturasEquipo, fechaActiva);
                        if (error) { setErrorModal(error); return; }
                        setIsSubmitting(true); setSubmitError(null);
                        try {
                          await solicitudesService.registrarLectura(selectedId, {
                            equipoId: activeEquipo, fecha: fechaActiva, tipo: 'inicio', valor: v,
                          });
                          await refreshLecturas(selectedId); setValor('');
                        } catch (err: unknown) {
                          const msg = getApiErrorMessage(err);
                          setSubmitError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al corregir.'));
                        } finally { setIsSubmitting(false); }
                      }}
                    />
                    <CorregirInput
                      label="Horómetro de cierre"
                      defaultValue={lecturaFecha?.horometroFin5pm ?? undefined}
                      onConfirm={async v => {
                        if (!selectedId) return;
                        setIsSubmitting(true); setSubmitError(null);
                        try {
                          await solicitudesService.registrarLectura(selectedId, {
                            equipoId: activeEquipo, fecha: fechaActiva, tipo: 'fin5pm', valor: v,
                          });
                          await refreshLecturas(selectedId); setValor('');
                        } catch (err: unknown) {
                          const msg = getApiErrorMessage(err);
                          setSubmitError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al corregir.'));
                        } finally { setIsSubmitting(false); }
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => setValor('')} className="text-xs text-slate-400 underline">
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  {tipoPendiente === 'fin5pm' && lecturaFecha && activeItem && activeItem.extras.length > 0 && (
                    <>
                      <ProgresoDelDiaTimeline lectura={lecturaFecha} />

                      <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-lg w-fit">
                        <button
                          type="button"
                          onClick={() => setFormTab('cierre')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            formTab === 'cierre' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Cerrar día
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormTab('cambio')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            formTab === 'cambio' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Cambiar complemento
                        </button>
                      </div>
                    </>
                  )}

                  {tipoPendiente === 'fin5pm' && lecturaFecha && activeItem && activeItem.extras.length > 0 && formTab === 'cambio' ? (
                    <CambioComplementoForm
                      lectura={lecturaFecha}
                      extras={activeItem.extras}
                      valor={tramoValor}
                      onValorChange={setTramoValor}
                      extraId={tramoExtraId}
                      onExtraIdChange={setTramoExtraId}
                      error={tramoError}
                      onSubmit={handleSubmitTramo}
                      onUndo={handleDeshacerTramo}
                      isUndoing={isUndoingTramo}
                    />
                  ) : (
                  <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
                    {tipoPendiente === 'fin5pm' && lecturaFecha?.horometroInicio != null && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs text-slate-600 self-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Inicio: <span className="font-mono font-bold ml-1">{lecturaFecha.horometroInicio}</span>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">
                        {tipoPendiente === 'inicio' ? 'Horómetro de inicio' : 'Horómetro de cierre (5PM)'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        placeholder="Ej: 1234.5"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        autoFocus
                      />
                    </div>
                    {tipoPendiente === 'inicio' && activeItem && activeItem.extras.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">
                          Complemento inicial
                        </label>
                        <select
                          value={inicioExtraId ?? ''}
                          onChange={e => setInicioExtraId(e.target.value || null)}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Ninguno</option>
                          {activeItem.extras.map(ex => (
                            <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
                          ))}
                        </select>
                        {complementoHeredadoNombre && (
                          <p className="text-xs text-slate-400 mt-1">
                            Heredado del día anterior: {complementoHeredadoNombre}
                          </p>
                        )}
                      </div>
                    )}

                    {tipoPendiente === 'inicio' && horasNocturnasDetectadas > 0 && activeItem && activeItem.extras.length > 0 && finAnteriorNum != null && (
                      <div className="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                        <p className="text-xs font-semibold text-indigo-700 mb-2">
                          🌙 Se detectan {horasNocturnasDetectadas.toFixed(1)}h nocturnas desde el cierre de ayer
                          ({fmtHorometro(finAnteriorNum)} → {fmtHorometro(valorInicioNum)})
                        </p>

                        <div className="space-y-1 mb-2">
                          {segmentosNocturnos.map((s, i) => (
                            <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-700">
                                  {fmtHorometro(s.desde)} → {fmtHorometro(s.hasta)}
                                </span>
                                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                                  s.extraId ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {s.extraId ? s.extraNombre : 'Sin complemento'}
                                </span>
                              </span>
                              <span className="font-mono text-slate-600">
                                {s.horas.toFixed(1)}h · {formatQ(s.costo)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                          {!corteFormOpen ? (
                            <button
                              type="button"
                              onClick={() => setCorteFormOpen(true)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                            >
                              + Agregar punto de cambio
                            </button>
                          ) : (
                            <>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Horómetro del cambio</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={corteValor}
                                  onChange={e => setCorteValor(e.target.value)}
                                  placeholder="Ej: 114.0"
                                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Complemento</label>
                                <select
                                  value={corteExtraId ?? ''}
                                  onChange={e => setCorteExtraId(e.target.value || null)}
                                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                >
                                  <option value="">Ninguno</option>
                                  {activeItem.extras.map(ex => (
                                    <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={handleAgregarCorte}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                              >
                                Agregar
                              </button>
                              <button
                                type="button"
                                onClick={() => { setCorteFormOpen(false); setCorteValor(''); setCorteExtraId(null); setCorteError(null); }}
                                className="text-xs text-slate-400 underline"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {cortesNocturnos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCortesNocturnos(cs => cs.slice(0, -1))}
                              className="text-xs text-slate-500 hover:text-slate-700 underline ml-auto"
                            >
                              Quitar último corte
                            </button>
                          )}
                        </div>

                        {corteError && (
                          <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{corteError}</p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !valor}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      )}
                      {tipoPendiente === 'inicio' ? 'Registrar inicio' : 'Registrar cierre'}
                    </button>
                  </form>
                  )}
                </>
              )}

              {submitError && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {submitError}
                </p>
              )}
            </div>

            {/* Lecturas table for the active month */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-700">
                  Lecturas — {MESES[mesActivo.mes]} {mesActivo.año}
                </p>
              </div>

              {lecturasEquipo === null ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
                </div>
              ) : lecturasDelMes.length === 0 && !(isFirstMonth && activeItem?.horometroInicial != null) ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p className="text-sm">Sin lecturas en este mes</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Fecha','Inicio','Fin 5PM','H. trab.','H. Noct.','Ajuste','Total'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Reference row: delivery reading (first month only) */}
                        {isFirstMonth && activeItem?.horometroInicial != null && (
                          <tr className="border-b border-amber-100 bg-amber-50/50">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-slate-500">{formatFechaCorta(fechaInicioStr)}</span>
                              <span className="ml-1.5 text-xs font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">entrega</span>
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-700">
                              {activeItem.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })}
                            </td>
                            <td colSpan={5} className="px-3 py-2 text-xs text-slate-400 italic">
                              Horómetro al momento de entrega al cliente
                            </td>
                          </tr>
                        )}

                        {lecturasDelMes.map(l => (
                          <Fragment key={l.id}>
                            <tr
                              onClick={() => handleSelectDia(l.fecha)}
                              className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors ${l.fecha === fechaActiva ? 'bg-indigo-50' : ''}`}
                            >
                              <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                                {formatFechaCorta(l.fecha)}
                                {tieneComplementoMixto(l) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedMixto(expandedMixto === l.fecha ? null : l.fecha);
                                    }}
                                    className="ml-1.5 text-xs font-semibold text-amber-600 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded-full"
                                  >
                                    mixto {expandedMixto === l.fecha ? '▲' : '▼'}
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600">
                                {l.horometroInicio ?? <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600">
                                {l.horometroFin5pm ?? <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600">
                                {l.horometroInicio != null && l.horometroFin5pm != null
                                  ? (l.horometroFin5pm - l.horometroInicio).toFixed(1)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-amber-600">
                                {l.horasNocturnas && l.horasNocturnas > 0 ? l.horasNocturnas.toFixed(1) : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-400">
                                {l.ajusteMinimo && l.ajusteMinimo > 0 ? `+${l.ajusteMinimo.toFixed(1)}` : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                {l.costoTotal != null ? formatQ(l.costoTotal) : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                            {expandedMixto === l.fecha && (
                              <tr className="border-b border-slate-100 last:border-0 bg-amber-50/40">
                                <td colSpan={7} className="px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Desglose de tramos — {formatFechaCorta(l.fecha)}
                                  </p>
                                  <ul className="space-y-1">
                                    {l.tramos.map((t, i) => (
                                      <li key={i} className="flex items-center justify-between text-xs">
                                        <span className={t.extraId ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                                          {t.extraId ? t.extraNombre : 'Sin complemento'}
                                          <span className="text-slate-400 font-mono ml-1.5">
                                            ({t.horometroDesde.toFixed(1)} → {t.horometroHasta.toFixed(1)})
                                          </span>
                                        </span>
                                        <span className="font-mono text-slate-600">
                                          {t.horas.toFixed(1)}h × {formatQ(t.tarifa)} = <strong>{formatQ(t.costo)}</strong>
                                        </span>
                                      </li>
                                    ))}
                                    {(l.tramosNocturnos ?? []).map((t, i) => (
                                      <li key={`n-${i}`} className="flex items-center justify-between text-xs">
                                        <span className={t.extraId ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                                          🌙 {t.extraId ? t.extraNombre : 'Sin complemento'}
                                          <span className="text-slate-400 font-mono ml-1.5">
                                            ({t.horometroDesde.toFixed(1)} → {t.horometroHasta.toFixed(1)})
                                          </span>
                                        </span>
                                        <span className="font-mono text-slate-600">
                                          {t.horas.toFixed(1)}h × {formatQ(t.tarifa)} = <strong>{formatQ(t.costo)}</strong>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {lecturasDelMes.length > 0 && (() => {
                    const subtotalCerrado    = lecturasDelMes.reduce((s, l) => s + (l.costoTotal ?? 0), 0);
                    const lecturaHoyAbierta  = lecturasDelMes.find(l => l.fecha === hoy && l.costoTotal == null);
                    const costoHoyEnCurso    = lecturaHoyAbierta?.tramos.reduce((s, t) => s + t.costo, 0) ?? 0;

                    if (costoHoyEnCurso <= 0) {
                      return (
                        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Subtotal mes</p>
                            <p className="text-base font-bold text-slate-800">{formatQ(subtotalCerrado)}</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                        <div className="w-64 space-y-1">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Subtotal mes (días cerrados)</span>
                            <span className="font-mono">{formatQ(subtotalCerrado)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-amber-600">
                            <span>+ Hoy (en curso)</span>
                            <span className="font-mono">{formatQ(costoHoyEnCurso)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-200">
                            <span className="text-xs font-semibold text-slate-600 self-end">Total acumulado</span>
                            <span className="text-base font-bold text-slate-800">{formatQ(subtotalCerrado + costoHoyEnCurso)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

          </div>
        </div>

        {/* Confirmation modal */}
        {pendingConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {pendingConfirm.tipo === 'tramo' ? 'Confirmar cambio de complemento' : 'Confirmar lectura'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {pendingConfirm.tipo === 'inicio' && pendingConfirm.extraId === undefined && 'Horómetro de inicio'}
                    {pendingConfirm.tipo === 'inicio' && pendingConfirm.extraId !== undefined && (
                      pendingConfirm.extraId
                        ? `Horómetro de inicio · CON ${pendingConfirm.extraNombre}`
                        : 'Horómetro de inicio · sin complemento'
                    )}
                    {pendingConfirm.tipo === 'fin5pm' && 'Horómetro de cierre (5PM)'}
                    {pendingConfirm.tipo === 'tramo' && (
                      pendingConfirm.extraId
                        ? `Cambio a CON ${pendingConfirm.extraNombre}`
                        : 'Cambio a SIN complemento'
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Fecha</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {formatFechaCorta(pendingConfirm.fecha)}
                    {pendingConfirm.fecha === hoy && <span className="ml-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">hoy</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {pendingConfirm.tipo === 'inicio' && 'Valor inicio'}
                    {pendingConfirm.tipo === 'fin5pm' && 'Valor cierre'}
                    {pendingConfirm.tipo === 'tramo' && 'Horómetro del cambio'}
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-700">
                    {pendingConfirm.valorNum.toLocaleString('es-GT', { minimumFractionDigits: 1 })} hrs
                  </span>
                </div>
                {pendingConfirm.tipo === 'fin5pm' && lecturaFecha?.horometroInicio != null && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="text-xs text-slate-400">Horas trabajadas</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">
                      {(pendingConfirm.valorNum - lecturaFecha.horometroInicio).toFixed(1)} hrs
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarLectura}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                    pendingConfirm.tipo === 'tramo' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {errorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800">{errorModal.titulo}</p>
              </div>
              <p className="text-sm text-slate-600 mb-5">{errorModal.mensaje}</p>
              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const pendientesCobrar = solicitudes.reduce((sum, s) => sum + s.costoAcumuladoPesada, 0);

  const solicitudesFiltradas = busqueda.trim()
    ? solicitudes.filter(s => {
        const q = busqueda.toLowerCase().trim();
        return (s.folio ?? '').toLowerCase().includes(q) || s.cliente.nombre.toLowerCase().includes(q);
      })
    : solicitudes;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Horómetros</h1>
        <p className="text-sm text-slate-500 mt-1">Registro diario de horas de maquinaria pesada en renta</p>
      </div>

      {modoEncargado && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <PesadaStatCard
            label="Pendientes de cobrar"
            sublabel="Rentas activas · según horómetros"
            value={pendientesCobrar}
            isLoading={isLoadingList}
            color="amber"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          />
          <PesadaStatCard
            label="Recaudado este mes"
            sublabel="Maquinaria pesada devuelta"
            value={pesadaStats?.pesadaRecaudadaMes ?? 0}
            isLoading={loadingPesadaStats}
            color="emerald"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por folio o cliente..."
          className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {!isLoadingList && pendientesHoy > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>{pendientesHoy}</strong>{' '}
            {pendientesHoy === 1 ? 'renta pesada sin registro completo hoy' : 'rentas pesadas sin registro completo hoy'}
          </span>
        </div>
      )}

      {listError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          {listError}
        </div>
      )}

      {isLoadingList ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : solicitudesFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {busqueda.trim() ? (
            <>
              <p className="text-sm font-medium">Sin resultados para esa búsqueda</p>
              <p className="text-xs text-center max-w-xs leading-relaxed">Intenta con otro folio o nombre de cliente.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Sin rentas pesadas activas</p>
              <p className="text-xs text-center max-w-xs leading-relaxed">
                Las rentas pesadas activas aparecerán aquí para registrar las lecturas diarias.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudesFiltradas.map(s => {
            const seccionDestino = (() => {
              const esVencida = !!s.fechaFinEstimada && new Date(s.fechaFinEstimada) < new Date();
              if (!esVencida) return 'rentas-activas';
              return modoEncargado ? 'vencidas' : 'rentas-vencidas';
            })();
            return (
              <HorometroRentaCard
                key={s.id}
                solicitud={s}
                lecturas={lecturasMap[s.id] ?? null}
                onVerDetalle={() => setSelectedId(s.id)}
                onRegistrar={() => setSelectedId(s.id)}
                onVerRenta={onNavTo ? () => onNavTo(seccionDestino, { folio: s.folio ?? undefined }) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stat card pesada ──────────────────────────────────────────────────────────
function PesadaStatCard({
  label, sublabel, value, isLoading, color, icon,
}: {
  label:     string;
  sublabel:  string;
  value:     number;
  isLoading: boolean;
  color:     'amber' | 'emerald';
  icon:      React.ReactNode;
}) {
  const styles = {
    amber:   { bg: '#fef3c7', fg: '#d97706', text: 'text-amber-700' },
    emerald: { bg: '#dcfce7', fg: '#16a34a', text: 'text-emerald-700' },
  }[color];

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: styles.bg, color: styles.fg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {isLoading ? (
          <div className="h-6 w-28 bg-slate-100 rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-xl font-bold font-mono leading-tight ${styles.text}`}>
            {formatQ(value)}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Tile de información de solo lectura (barra de info del equipo) ────────────
function InfoTile({
  label, value, icon, color,
}: {
  label: string;
  value: React.ReactNode;
  icon:  React.ReactNode;
  color: 'slate' | 'amber' | 'emerald' | 'red';
}) {
  const styles = {
    slate:   { bg: '#f1f5f9', fg: '#475569', text: 'text-slate-700' },
    amber:   { bg: '#fef3c7', fg: '#d97706', text: 'text-amber-700' },
    emerald: { bg: '#dcfce7', fg: '#16a34a', text: 'text-emerald-700' },
    red:     { bg: '#fee2e2', fg: '#dc2626', text: 'text-red-600' },
  }[color];

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: styles.bg, color: styles.fg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {icon}
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm font-bold truncate ${styles.text}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Progreso de tramos del día (cambios de complemento intradía) ──────────────────
function ProgresoDelDiaTimeline({ lectura }: { lectura: LecturaHorometro }) {
  const fmt = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 1 });

  type Paso = {
    desde:       number;
    hasta:       number | null;
    extraId:     string | null;
    extraNombre: string | null;
    horas:       number | null;
    costo:       number | null;
    abierto:     boolean;
  };

  const pasos: Paso[] = [
    ...lectura.tramos.map(t => ({
      desde: t.horometroDesde, hasta: t.horometroHasta,
      extraId: t.extraId, extraNombre: t.extraNombre,
      horas: t.horas, costo: t.costo, abierto: false,
    })),
    {
      desde: lectura.tramos.length > 0
        ? lectura.tramos[lectura.tramos.length - 1].horometroHasta
        : (lectura.horometroInicio ?? 0),
      hasta: null,
      extraId: lectura.complementoActivoId ?? null,
      extraNombre: lectura.complementoActivoNombre ?? null,
      horas: null, costo: null, abierto: true,
    },
  ];

  return (
    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progreso del día</p>

      <div className="relative pl-5">
        <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200" />
        {pasos.map((p, i) => (
          <div key={i} className="relative pb-3 last:pb-0">
            <span
              className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-50 ${
                p.abierto
                  ? (p.extraId ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 animate-pulse')
                  : (p.extraId ? 'bg-amber-500' : 'bg-slate-300')
              }`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-700">
                  {fmt(p.desde)} {p.hasta != null && <>→ {fmt(p.hasta)}</>}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.extraId ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.extraId && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                  )}
                  {p.extraId ? p.extraNombre : 'Sin complemento'}
                </span>
              </div>
              <span className="text-xs">
                {p.abierto ? (
                  <span className="italic text-slate-400">en curso</span>
                ) : (
                  <span className="font-mono">
                    <span className="text-slate-500">{p.horas!.toFixed(1)}h</span>
                    {' · '}
                    <span className="font-bold text-slate-700">{formatQ(p.costo!)}</span>
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Formulario del tab "Cambiar complemento" ───────────────────────────────────
function CambioComplementoForm({
  lectura, extras, valor, onValorChange, extraId, onExtraIdChange, error, onSubmit, onUndo, isUndoing,
}: {
  lectura:         LecturaHorometro;
  extras:          ExtraSeleccionado[];
  valor:           string;
  onValorChange:   (v: string) => void;
  extraId:         string | null;
  onExtraIdChange: (v: string | null) => void;
  error:           string | null;
  onSubmit:        (e: React.FormEvent) => void;
  onUndo:          () => void;
  isUndoing:       boolean;
}) {
  return (
    <div className="mb-2">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Horómetro</label>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={e => onValorChange(e.target.value)}
            placeholder="Ej: 112.7"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Complemento</label>
          <select
            value={extraId ?? ''}
            onChange={e => onExtraIdChange(e.target.value || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Ninguno</option>
            {extras.map(ex => (
              <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!valor}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Registrar cambio
        </button>
        {lectura.tramos.length > 0 && (
          <button
            type="button"
            onClick={onUndo}
            disabled={isUndoing}
            className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            {isUndoing ? 'Deshaciendo…' : 'Quitar último cambio'}
          </button>
        )}
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>
      )}
    </div>
  );
}

// ── Subcomponente de corrección ────────────────────────────────────────────────
function CorregirInput({
  label,
  defaultValue,
  onConfirm,
}: {
  label:         string;
  defaultValue?: number;
  onConfirm:     (v: number) => Promise<void>;
}) {
  const [val, setVal] = useState(defaultValue?.toString() ?? '');
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-28 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
        />
        <button
          type="button"
          disabled={!val}
          onClick={() => { const n = parseFloat(val); if (!isNaN(n)) void onConfirm(n); }}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
