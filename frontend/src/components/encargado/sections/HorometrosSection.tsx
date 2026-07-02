import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import type { AxiosError } from 'axios';
import { solicitudesService, type LecturaHorometro, type DashboardStats } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot, ExtraSeleccionado } from '../../../types/solicitud-renta.types';
import { formatQ } from '../../../types/solicitud.types';
import {
  today, getDiaStatus, tieneComplementoMixto, complementoNocturnoUnico,
  formatFechaCorta, localDateOf, ultimoDiaHorometro, validarInicioHorometro, diasPendientesAnteriores,
} from '../../../utils/horometro.utils';
import HorometroRentaCard from '../HorometroRentaCard';
import CalendarioMes from '../CalendarioMes';
import { useActivasStore, useAdminActivasStore } from '../../../store/activas.store';
import { useVencidasStore, useAdminVencidasStore } from '../../../store/vencidas.store';
import FiltroProyecto from '../../shared/FiltroProyecto';
import { filtrarPorProyecto } from '../../../utils/filtrar-por-proyecto';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

const RECARGO_NOCTURNO = 100; // Q extra por hora nocturna — mismo valor que backend/horometro-calc.service.ts
const fmtHorometro = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 1 });

// Ícono de luna (trazo, estilo Lucide) — reemplaza el emoji 🌙 para que el color herede `currentColor`
// (y por lo tanto el `tono` de marca) en vez de depender del render de emoji de cada sistema operativo.
function IconoLuna({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

// Tema de color del acento principal de esta sección — un único acento de marca (`brand`) para
// encargado y admin/secretaria (ver docs/redisenoUI.md §2.4: un solo acento para ambos paneles).
// No reemplaza los colores semánticos fijos (emerald = dinero/tarifa, red = vencido, slate = neutral).
export interface TonoHorometro {
  boton:        string; // botón primario (fondo + hover)
  texto:        string; // texto de acento, peso fuerte (títulos, valores destacados)
  textoSuave:   string; // texto de acento, peso medio
  link:         string; // links de acento (texto + hover)
  fondoSuave:   string; // fondo de cajas informativas
  borde:        string; // borde de cajas informativas
  badge:        string; // fondo + texto de badges (ej. "entrega")
  badgeHover:   string; // badge interactivo (ej. "mixto")
  pillActiva:   string; // pill/tab seleccionada (ej. selector de equipo)
  iconoFondo:   string; // fondo de ícono circular
  iconoTexto:   string; // color del ícono
  punto:        string; // punto/dot de estado activo en líneas de tiempo
  hexBg:        string; // fondo de ícono circular (estilo inline, InfoTile/PesadaStatCard)
  hexFg:        string; // color de ícono (estilo inline, InfoTile/PesadaStatCard)
}

const TONO_BRAND: TonoHorometro = {
  boton:      'bg-brand-600 hover:bg-brand-700',
  texto:      'text-brand-700',
  textoSuave: 'text-brand-600',
  link:       'text-brand-700 hover:text-brand-800',
  fondoSuave: 'bg-brand-50',
  borde:      'border-brand-100',
  badge:      'bg-brand-100 text-brand-700',
  badgeHover: 'bg-brand-100 hover:bg-brand-200 text-brand-600',
  pillActiva: 'bg-brand-50 border-brand-300 text-brand-700',
  iconoFondo: 'bg-brand-100',
  iconoTexto: 'text-brand-600',
  punto:      'bg-brand-500',
  hexBg:      '#DCE7F8',
  hexFg:      '#2856B8',
};

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
  const [busqueda,       setBusqueda]      = useState('');
  const [filtroProyecto, setFiltroProyecto] = useState<string | null>(null);

  const { proyectosHorometros, hayIndependientesHorometros } = useMemo(() => {
    const map = new Map<string, string>();
    let sinProyecto = false;
    for (const s of solicitudes) {
      if (s.proyecto) map.set(s.proyecto.id, s.proyecto.nombre);
      else            sinProyecto = true;
    }
    return {
      proyectosHorometros:         Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre })),
      hayIndependientesHorometros: sinProyecto,
    };
  }, [solicitudes]);

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
    horasTramo?:  number;
    costoTramo?:  number;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{ titulo: string; mensaje: string } | null>(null);

  // Tramo (cambio de complemento intradía) form state — "Marcar cambio de complemento" es una
  // acción secundaria inline (no una pestaña): tramoFormOpen solo controla si está desplegada.
  const [tramoFormOpen, setTramoFormOpen] = useState(false);
  const [tramoError,    setTramoError]    = useState<string | null>(null);
  const [isUndoingTramo, setIsUndoingTramo] = useState(false);
  const [expandedMixto, setExpandedMixto] = useState<string | null>(null);

  // Complemento inicial del día (solo aplica al registrar el horómetro de inicio de un día nuevo)
  const [inicioExtraId, setInicioExtraId] = useState<string | null>(null);

  // Tramos de la noche anterior (cuando el inicio de hoy implica horas nocturnas) — se construyen
  // en el cliente y se envían junto con el horómetro de inicio, sin llamadas intermedias al servidor.
  // `nocheModo` decide qué tan detallado se ve el editor: el caso simple (toda la noche con o sin
  // complemento) no necesita ver el concepto de "tramos" en absoluto.
  // `nocheTramos.cortes` son los puntos donde se divide la noche; `complementos` tiene SIEMPRE un
  // elemento más que `cortes` (uno por tramo resultante) — se guardan juntos en un solo estado para
  // que sea imposible que se desincronicen entre sí (antes eran 2 estados separados y un useEffect
  // los recomponía un render después, lo que dejaba una fracción de render con tamaños distintos).
  const [nocheModo,        setNocheModo]        = useState<'sin' | 'con' | 'mixto'>('sin');
  const [nocheTramos,      setNocheTramos]      = useState<{ cortes: number[]; complementos: (string | null)[] }>({
    cortes: [], complementos: [null],
  });
  const [divisionFormOpen, setDivisionFormOpen] = useState(false);
  const [divisionError,    setDivisionError]    = useState<string | null>(null);

  const resetTramoForm = () => {
    setTramoFormOpen(false); setTramoError(null);
    setNocheModo('sin'); setNocheTramos({ cortes: [], complementos: [null] });
    setDivisionFormOpen(false); setDivisionError(null);
  };

  const resolvedFetch  = fetchSolicitudes ?? fetchSolicitudesEncargado;
  const modoEncargado  = fetchSolicitudes == null;
  // Esta sección la usan tanto encargado como admin/secretaria (vía admin/sections/HorometrosSection.tsx,
  // que envuelve este mismo componente) — ambos comparten el mismo acento de marca (`brand`).
  const tono = TONO_BRAND;

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
    if (tipoPendiente === 'inicio') {
      setInicioExtraId(complementoHeredadoId);
      setNocheModo(complementoHeredadoId ? 'con' : 'sin');
      setNocheTramos({ cortes: [], complementos: [complementoHeredadoId] });
    }
  }, [activeEquipo, fechaActiva, tipoPendiente, complementoHeredadoId]);

  // Detección en vivo de horas nocturnas: si lo que se está escribiendo como horómetro de inicio
  // es mayor al cierre de ayer, hubo horas nocturnas que el usuario puede dividir en tramos.
  const finAnteriorNum  = diaAnteriorCerrado?.horometroFin5pm ?? null;
  const valorInicioNum  = tipoPendiente === 'inicio' ? parseFloat(valor) : NaN;
  const horasNocturnasDetectadas = (finAnteriorNum != null && !isNaN(valorInicioNum))
    ? valorInicioNum - finAnteriorNum
    : 0;

  // Quita los cortes que dejaron de tener sentido (ej. el usuario bajó el horómetro escrito) — cortes
  // y complementos se actualizan siempre juntos, en la misma llamada, para que nunca queden desincronizados.
  useEffect(() => {
    if (finAnteriorNum == null || isNaN(valorInicioNum)) return;
    setNocheTramos(nt => {
      const cortesValidos = nt.cortes.filter(c => c > finAnteriorNum && c < valorInicioNum);
      if (cortesValidos.length === nt.cortes.length) return nt;
      return { cortes: cortesValidos, complementos: nt.complementos.slice(0, cortesValidos.length + 1) };
    });
  }, [finAnteriorNum, valorInicioNum]);

  // Segmentos de la noche anterior — mismo cálculo que hace el backend, para mostrar el preview en vivo.
  const segmentosNocturnos = (() => {
    if (horasNocturnasDetectadas <= 0 || finAnteriorNum == null || !activeItem) return [];
    const bordes = [finAnteriorNum, ...nocheTramos.cortes, valorInicioNum];
    return nocheTramos.complementos.map((extraId, i) => {
      const desde  = bordes[i];
      const hasta  = bordes[i + 1];
      const horas  = Math.max(0, hasta - desde);
      const extra  = extraId ? activeItem.extras.find(ex => ex.tipoExtraId === extraId) : undefined;
      const tarifa = activeItem.tarifaEfectiva + (extra?.rentaHora ?? 0) + RECARGO_NOCTURNO;
      return { desde, hasta, extraId, extraNombre: extra?.nombre ?? null, horas, costo: horas * tarifa };
    });
  })();

  // Cambia el modo de la noche: 'sin'/'con' colapsan siempre a un solo tramo (sin exponer
  // el concepto de "tramos" al usuario); 'mixto' revela el editor de divisiones.
  const handleCambiarModoNoche = (modo: 'sin' | 'con' | 'mixto') => {
    setNocheModo(modo);
    if (modo === 'sin') {
      setNocheTramos({ cortes: [], complementos: [null] });
    } else if (modo === 'con') {
      const elegido = nocheTramos.complementos[0] ?? complementoHeredadoId ?? activeItem?.extras[0]?.tipoExtraId ?? null;
      setNocheTramos({ cortes: [], complementos: [elegido] });
    }
    // 'mixto' no resetea nada: continúa desde el tramo único que ya hubiera (sin o con complemento)
    // y el usuario lo divide a partir de ahí.
  };

  const handleCambiarComplementoSegmento = (index: number, extraId: string | null) => {
    setNocheTramos(nt => ({ ...nt, complementos: nt.complementos.map((c, i) => i === index ? extraId : c) }));
  };

  const handleDividirTramoNocturno = (v: number, extraId: string | null) => {
    if (finAnteriorNum == null) return;
    if (isNaN(v)) { setDivisionError('Ingresa un horómetro válido.'); return; }
    const ultimoCorte = nocheTramos.cortes.length > 0 ? nocheTramos.cortes[nocheTramos.cortes.length - 1] : finAnteriorNum;
    if (v <= ultimoCorte || v >= valorInicioNum) {
      setDivisionError(`El punto de división debe ser mayor a ${fmtHorometro(ultimoCorte)} y menor a ${fmtHorometro(valorInicioNum)} hrs.`);
      return;
    }
    const ultimoComplemento = nocheTramos.complementos[nocheTramos.complementos.length - 1];
    if (extraId === ultimoComplemento) {
      setDivisionError('Selecciona un complemento distinto al del tramo anterior.');
      return;
    }
    setNocheTramos(nt => ({ cortes: [...nt.cortes, v], complementos: [...nt.complementos, extraId] }));
    setDivisionError(null); setDivisionFormOpen(false);
  };

  const handleUnirUltimoTramoNocturno = () => {
    setNocheTramos(nt => ({ cortes: nt.cortes.slice(0, -1), complementos: nt.complementos.slice(0, -1) }));
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
  const handleSubmitTramo = (valorNum: number, tramoExtraId: string | null) => {
    if (!selectedId || !lecturaFecha || lecturaFecha.horometroInicio == null) return;
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
    // Horas y costo del tramo que se está cerrando (con la tarifa del complemento activo HASTA ahora,
    // no la del nuevo), para mostrarlos en la confirmación junto con el horómetro del cambio.
    const horasTramo  = valorNum - ultimaReferencia;
    const extraActivo = activoActual ? activeItem?.extras.find(ex => ex.tipoExtraId === activoActual) : undefined;
    const costoTramo  = horasTramo * ((activeItem?.tarifaEfectiva ?? 0) + (extraActivo?.rentaHora ?? 0));
    // No cerramos tramoFormOpen aquí — si el usuario cancela el modal de confirmación, el formulario
    // inline se queda abierto con sus valores (igual que el resto de los formularios de esta vista).
    // Se cierra en resetTramoForm() solo cuando el cambio realmente se confirma y persiste.
    setPendingConfirm({ tipo: 'tramo', valorNum, fecha: fechaActiva, extraId: tramoExtraId, extraNombre, horasTramo, costoTramo });
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
          ...(confirm.tipo === 'inicio' && horasNocturnasDetectadas > 0 ? {
            complementoNocturnoInicialId: nocheTramos.complementos[0] ?? null,
            tramosNocturnos: nocheTramos.cortes.map((horometroCorte, i) => ({
              horometroCorte,
              extraId: nocheTramos.complementos[i + 1] ?? null,
            })),
          } : {}),
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
                    ? tono.pillActiva
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
              tono={tono}
              label="Equipo"
              value={<><span className="font-mono text-slate-400 mr-1">#{activeItem.numeracion}</span>{activeItem.descripcion}</>}
              icon={<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
              color="slate"
            />
            {activeItem.horometroInicial != null && (
              <InfoTile
                tono={tono}
                label="Entrega al cliente"
                value={`${activeItem.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })} hrs`}
                icon={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                color="acento"
              />
            )}
            <InfoTile
              tono={tono}
              label="Tarifa"
              value={`${formatQ(activeItem.tarifaEfectiva)}/hr`}
              icon={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>}
              color="emerald"
            />
            <InfoTile
              tono={tono}
              label="Inicio de renta"
              value={fechaInicioStr.split('-').reverse().join('/')}
              icon={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}
              color="slate"
            />
            {selectedSol.fechaFinEstimada && (
              <InfoTile
                tono={tono}
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
          <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] p-5">
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
            <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] p-5">
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
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
                      tono={tono}
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
                      tono={tono}
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
                  {/* Línea de tramos del día, siempre visible — la misma interfaz que se usa para la noche */}
                  {tipoPendiente === 'fin5pm' && lecturaFecha && activeItem && activeItem.extras.length > 0 && (
                    <TramoTimeline titulo="Progreso del día" segmentos={segmentosDelDia(lecturaFecha)} tono={tono} />
                  )}

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
                        {tipoPendiente === 'inicio' ? 'Horómetro de inicio' : 'Horómetro de cierre'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        placeholder="Ej: 1234.5"
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
                      <div className={`w-full p-3 ${tono.fondoSuave}/60 border ${tono.borde} rounded-lg`}>
                        <p className={`text-xs font-semibold ${tono.texto} mb-1 flex items-center gap-1`}>
                          <IconoLuna className="w-3.5 h-3.5" /> Se detectan {horasNocturnasDetectadas.toFixed(1)}h nocturnas desde el cierre de ayer
                          ({fmtHorometro(finAnteriorNum)} → {fmtHorometro(valorInicioNum)})
                        </p>
                        <p className="text-xs text-slate-500 mb-2">¿Cómo se trabajaron estas horas?</p>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <button
                            type="button"
                            onClick={() => handleCambiarModoNoche('sin')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              nocheModo === 'sin' ? `${tono.boton} text-white` : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            Sin complemento
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCambiarModoNoche('con')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              nocheModo === 'con' ? `${tono.boton} text-white` : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {activeItem.extras.length === 1 ? `Con ${activeItem.extras[0].nombre}` : 'Con complemento'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCambiarModoNoche('mixto')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              nocheModo === 'mixto' ? `${tono.boton} text-white` : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            Cambió durante la noche
                          </button>
                        </div>

                        {nocheModo === 'con' && activeItem.extras.length > 1 && (
                          <select
                            value={nocheTramos.complementos[0] ?? ''}
                            onChange={e => setNocheTramos({ cortes: [], complementos: [e.target.value || null] })}
                            className="mb-2 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                          >
                            {activeItem.extras.map(ex => (
                              <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
                            ))}
                          </select>
                        )}

                        {nocheModo !== 'mixto' && segmentosNocturnos[0] && (
                          <p className="text-xs font-mono text-slate-500">
                            {segmentosNocturnos[0].horas.toFixed(1)}h · {formatQ(segmentosNocturnos[0].costo)}
                          </p>
                        )}

                        {nocheModo === 'mixto' && (
                          <div className="mt-1">
                            <TramoTimeline
                              titulo="Tramos de la noche"
                              segmentos={segmentosNocturnos.map(s => ({ ...s, nocturno: true }))}
                              tono={tono}
                              extras={activeItem.extras}
                              onCambiarComplemento={handleCambiarComplementoSegmento}
                              onQuitarSegmento={() => handleUnirUltimoTramoNocturno()}
                            />

                            {!divisionFormOpen ? (
                              <button
                                type="button"
                                onClick={() => setDivisionFormOpen(true)}
                                className={`text-xs font-semibold ${tono.link}`}
                              >
                                + Marcar otro cambio
                              </button>
                            ) : (
                              <MarcarCambioInline
                                extras={activeItem.extras}
                                tono={tono}
                                referenciaMin={nocheTramos.cortes.length > 0 ? nocheTramos.cortes[nocheTramos.cortes.length - 1] : finAnteriorNum}
                                referenciaMax={valorInicioNum}
                                onSubmit={handleDividirTramoNocturno}
                                onCancel={() => { setDivisionFormOpen(false); setDivisionError(null); }}
                                error={divisionError}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !valor}
                      className={`px-4 py-2 rounded-lg ${tono.boton} text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2`}
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
                      {tipoPendiente === 'inicio' ? 'Registrar inicio' : 'Cerrar día'}
                    </button>
                  </form>

                  {/* Acción secundaria: marcar un cambio de complemento durante el día — solo si ya hay
                      inicio registrado y el equipo tiene complementos. No es una pestaña: el cierre
                      sigue siendo la acción primaria, siempre visible arriba. */}
                  {tipoPendiente === 'fin5pm' && lecturaFecha && activeItem && activeItem.extras.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {!tramoFormOpen ? (
                        <button
                          type="button"
                          onClick={() => setTramoFormOpen(true)}
                          className={`text-xs font-semibold ${tono.link}`}
                        >
                          + Marcar cambio de complemento
                        </button>
                      ) : (
                        <MarcarCambioInline
                          extras={activeItem.extras}
                          tono={tono}
                          referenciaMin={lecturaFecha.tramos.length > 0
                            ? lecturaFecha.tramos[lecturaFecha.tramos.length - 1].horometroHasta
                            : lecturaFecha.horometroInicio!}
                          onSubmit={handleSubmitTramo}
                          onCancel={() => { setTramoFormOpen(false); setTramoError(null); }}
                          error={tramoError}
                        />
                      )}
                      {lecturaFecha.tramos.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDeshacerTramo}
                          disabled={isUndoingTramo}
                          className="text-xs text-slate-500 hover:text-slate-700 underline disabled:opacity-40 transition-colors"
                        >
                          {isUndoingTramo ? 'Deshaciendo…' : 'Quitar último cambio'}
                        </button>
                      )}
                    </div>
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
            <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] overflow-hidden">
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
                          {['Fecha','Inicio','Cierre','H. trab.','H. Noct.','Ajuste','Total'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Reference row: delivery reading (first month only) */}
                        {isFirstMonth && activeItem?.horometroInicial != null && (
                          <tr className={`border-b ${tono.borde} ${tono.fondoSuave}/50`}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-slate-500">{formatFechaCorta(fechaInicioStr)}</span>
                              <span className={`ml-1.5 text-xs font-semibold ${tono.badge} px-1.5 py-0.5 rounded-full`}>entrega</span>
                            </td>
                            <td className={`px-3 py-2 font-mono font-bold ${tono.texto}`}>
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
                              className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors ${l.fecha === fechaActiva ? tono.fondoSuave : ''}`}
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
                                    className={`ml-1.5 text-xs font-semibold ${tono.badgeHover} px-1.5 py-0.5 rounded-full`}
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
                              <td className={`px-3 py-2 font-mono ${tono.textoSuave} whitespace-nowrap`}>
                                {l.horasNocturnas && l.horasNocturnas > 0 ? (
                                  <>
                                    {l.horasNocturnas.toFixed(1)}
                                    {complementoNocturnoUnico(l) && (
                                      <span className={`ml-1 text-xs font-sans ${tono.textoSuave}`}>({complementoNocturnoUnico(l)})</span>
                                    )}
                                  </>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-400">
                                {l.ajusteMinimo && l.ajusteMinimo > 0 ? `+${l.ajusteMinimo.toFixed(1)}` : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                {l.costoTotal != null ? formatQ(l.costoTotal) : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                            {expandedMixto === l.fecha && (
                              <tr className={`border-b border-slate-100 last:border-0 ${tono.fondoSuave}/40`}>
                                <td colSpan={7} className="px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Desglose de tramos — {formatFechaCorta(l.fecha)}
                                  </p>
                                  <ul className="space-y-1">
                                    {l.tramos.map((t, i) => (
                                      <li key={i} className="flex items-start justify-between gap-2 text-xs">
                                        <span className={`min-w-0 ${t.extraId ? `${tono.texto} font-medium` : 'text-slate-500'}`}>
                                          {t.extraId ? t.extraNombre : 'Sin complemento'}
                                          <span className="text-slate-400 font-mono ml-1.5">
                                            ({t.horometroDesde.toFixed(1)} → {t.horometroHasta.toFixed(1)})
                                          </span>
                                        </span>
                                        <span className="font-mono text-slate-600 flex-shrink-0 whitespace-nowrap">
                                          {t.horas.toFixed(1)}h × {formatQ(t.tarifa)} = <strong>{formatQ(t.costo)}</strong>
                                        </span>
                                      </li>
                                    ))}
                                    {(l.tramosNocturnos ?? []).map((t, i) => (
                                      <li key={`n-${i}`} className="flex items-start justify-between gap-2 text-xs">
                                        <span className={`min-w-0 ${t.extraId ? `${tono.texto} font-medium` : 'text-slate-500'}`}>
                                          <IconoLuna className="w-3 h-3 inline -mt-0.5 mr-1" />
                                          {t.extraId ? t.extraNombre : 'Sin complemento'}
                                          <span className="text-slate-400 font-mono ml-1.5">
                                            ({t.horometroDesde.toFixed(1)} → {t.horometroHasta.toFixed(1)})
                                          </span>
                                        </span>
                                        <span className="font-mono text-slate-600 flex-shrink-0 whitespace-nowrap">
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
                          <div className={`flex justify-between text-xs ${tono.textoSuave}`}>
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
                <div className={`w-10 h-10 rounded-full ${tono.iconoFondo} flex items-center justify-center flex-shrink-0`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={tono.iconoTexto}>
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
                    {pendingConfirm.tipo === 'fin5pm' && 'Horómetro de cierre'}
                    {pendingConfirm.tipo === 'tramo' && (
                      pendingConfirm.extraId
                        ? `Cambio a CON ${pendingConfirm.extraNombre}`
                        : 'Cambio a SIN complemento'
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Fecha</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {formatFechaCorta(pendingConfirm.fecha)}
                    {pendingConfirm.fecha === hoy && <span className={`ml-1.5 text-xs font-semibold ${tono.badge} px-1.5 py-0.5 rounded-full`}>hoy</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {pendingConfirm.tipo === 'inicio' && 'Valor inicio'}
                    {pendingConfirm.tipo === 'fin5pm' && 'Valor cierre'}
                    {pendingConfirm.tipo === 'tramo' && 'Horómetro del cambio'}
                  </span>
                  <span className={`text-lg font-bold font-mono ${tono.texto}`}>
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
                {pendingConfirm.tipo === 'tramo' && pendingConfirm.horasTramo != null && pendingConfirm.costoTramo != null && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="text-xs text-slate-400">Tramo que se cierra</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">
                      {pendingConfirm.horasTramo.toFixed(1)}h · {formatQ(pendingConfirm.costoTramo)}
                    </span>
                  </div>
                )}
              </div>

              {pendingConfirm.tipo === 'inicio' && horasNocturnasDetectadas > 0 && segmentosNocturnos.length > 0 && (
                <div className="border border-slate-200 rounded-xl px-4 py-3 mb-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tramos nocturnos a cobrar</p>
                  <div className="space-y-1">
                    {segmentosNocturnos.map((s, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-slate-600 min-w-0">
                          <IconoLuna className="w-3 h-3 inline -mt-0.5 mr-1" />
                          {s.extraNombre ?? 'Sin complemento'}{' '}
                          <span className="font-mono text-slate-400">({fmtHorometro(s.desde)}→{fmtHorometro(s.hasta)})</span>
                        </span>
                        <span className="font-mono text-slate-700 flex-shrink-0 whitespace-nowrap">{s.horas.toFixed(1)}h · {formatQ(s.costo)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                    <span className="text-xs text-slate-400">Total nocturno</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">
                      {formatQ(segmentosNocturnos.reduce((a, s) => a + s.costo, 0))}
                    </span>
                  </div>
                </div>
              )}

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
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${tono.boton}`}
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

  const solicitudesFiltradas = filtrarPorProyecto(
    busqueda.trim()
      ? solicitudes.filter(s => {
          const q = busqueda.toLowerCase().trim();
          return (s.folio ?? '').toLowerCase().includes(q) || s.cliente.nombre.toLowerCase().includes(q);
        })
      : solicitudes,
    filtroProyecto,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Horómetros</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Registro diario de horas de maquinaria pesada en renta</p>
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

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por folio o cliente..."
          className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <FiltroProyecto proyectos={proyectosHorometros} hayIndependientes={hayIndependientesHorometros} value={filtroProyecto} onChange={setFiltroProyecto} />
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
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] px-5 py-4 flex items-center gap-4">
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
  label, value, icon, color, tono,
}: {
  label: string;
  value: React.ReactNode;
  icon:  React.ReactNode;
  color: 'slate' | 'acento' | 'emerald' | 'red';
  tono:  TonoHorometro;
}) {
  const styles = {
    slate:   { bg: '#f1f5f9', fg: '#475569', text: 'text-slate-700' },
    acento:  { bg: tono.hexBg, fg: tono.hexFg, text: tono.texto },
    emerald: { bg: '#dcfce7', fg: '#16a34a', text: 'text-emerald-700' },
    red:     { bg: '#fee2e2', fg: '#dc2626', text: 'text-red-600' },
  }[color];

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(37,86,184,0.12)] px-4 py-3 flex items-center gap-3">
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
/** Segmento normalizado para `TramoTimeline` — el mismo shape sirve para tramos del día, de la noche y el paso "en curso". */
export interface SegmentoVista {
  desde:       number;
  hasta:       number | null; // null = "en curso" (segmento abierto del día)
  extraId:     string | null;
  extraNombre: string | null;
  horas:       number | null;
  costo:       number | null;
  nocturno?:   boolean;       // pinta el ícono de luna
  abierto?:    boolean;       // punto pulsante "en curso"
}

/** Construye los segmentos del día (tramos cerrados + el tramo abierto en curso) a partir de una lectura. */
function segmentosDelDia(lectura: LecturaHorometro): SegmentoVista[] {
  return [
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
}

// ── Línea de tramos — un solo componente para el progreso del día y para la noche ──────────────
// Modo solo-lectura (sin `extras`/`onCambiarComplemento`): se ve como el "Progreso del día" de
// siempre. Modo editable (con ambos): cada fila cerrada desde `segmentoEditableDesde` muestra un
// <select> de complemento en vez del badge, y la última fila puede "quitarse" (deshacer el último
// cambio) — así el día y la noche se editan con la misma interfaz.
function TramoTimeline({
  titulo, segmentos, tono, extras, onCambiarComplemento, onQuitarSegmento, segmentoEditableDesde = 0,
}: {
  titulo:                 string;
  segmentos:               SegmentoVista[];
  tono:                    TonoHorometro;
  extras?:                 ExtraSeleccionado[];
  onCambiarComplemento?:   (index: number, extraId: string | null) => void;
  onQuitarSegmento?:       (index: number) => void;
  segmentoEditableDesde?:  number;
}) {
  const fmt = fmtHorometro;
  const puedeMostrarQuitar = (i: number) =>
    !!onQuitarSegmento && i === segmentos.length - 1 && segmentos.length > segmentoEditableDesde + 1;

  return (
    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{titulo}</p>

      <div className="relative pl-5">
        <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200" />
        {segmentos.map((s, i) => {
          const editable = !!extras && !!onCambiarComplemento && i >= segmentoEditableDesde && s.hasta != null;
          return (
            <div key={i} className="relative pb-3 last:pb-0">
              <span
                className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-50 ${
                  s.abierto
                    ? (s.extraId ? `${tono.punto} animate-pulse` : 'bg-slate-400 animate-pulse')
                    : (s.extraId ? tono.punto : 'bg-slate-300')
                }`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {fmt(s.desde)} {s.hasta != null && <>→ {fmt(s.hasta)}</>}
                  </span>
                  {s.nocturno && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${tono.badge}`}>
                      <IconoLuna className="w-3 h-3" /> noche
                    </span>
                  )}
                  {editable ? (
                    <select
                      value={s.extraId ?? ''}
                      onChange={e => onCambiarComplemento!(i, e.target.value || null)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">Sin complemento</option>
                      {extras!.map(ex => (
                        <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.extraId ? tono.badge : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.extraId && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                      )}
                      {s.extraId ? s.extraNombre : 'Sin complemento'}
                    </span>
                  )}
                  {editable && puedeMostrarQuitar(i) && (
                    <button
                      type="button"
                      onClick={() => onQuitarSegmento!(i)}
                      title="Quitar este cambio"
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
                <span className="text-xs">
                  {s.abierto ? (
                    <span className="italic text-slate-400">en curso</span>
                  ) : (
                    <span className="font-mono">
                      <span className="text-slate-500">{s.horas!.toFixed(1)}h</span>
                      {' · '}
                      <span className="font-bold text-slate-700">{formatQ(s.costo!)}</span>
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Control único "marcar un cambio de complemento" — el mismo input+select+confirmar se usa para
// el cambio intradía (persiste al instante con registrarTramo) y para dividir la noche (solo en
// memoria, hasta que se registre el inicio). Lo único que cambia es el onSubmit inyectado.
function MarcarCambioInline({
  extras, tono, referenciaMin, referenciaMax, onSubmit, onCancel, error,
}: {
  extras:         ExtraSeleccionado[];
  tono:           TonoHorometro;
  referenciaMin:  number;
  referenciaMax?: number;
  onSubmit:       (horometro: number, extraId: string | null) => void;
  onCancel:       () => void;
  error:          string | null;
}) {
  const [valor, setValor]     = useState('');
  const [extraId, setExtraId] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs text-slate-500 block mb-1">¿En qué horómetro cambió?</label>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder={referenciaMax != null
            ? `Entre ${fmtHorometro(referenciaMin)} y ${fmtHorometro(referenciaMax)}`
            : `Mayor a ${fmtHorometro(referenciaMin)}`}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-40 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">Complemento</label>
        <select
          value={extraId ?? ''}
          onChange={e => setExtraId(e.target.value || null)}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Ninguno</option>
          {extras.map(ex => (
            <option key={ex.tipoExtraId} value={ex.tipoExtraId}>{ex.nombre}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!valor}
        onClick={() => onSubmit(parseFloat(valor), extraId)}
        className={`px-3 py-1.5 rounded-lg ${tono.boton} text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Marcar cambio
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-slate-400 underline">
        Cancelar
      </button>
      {error && (
        <p className="w-full mt-1 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>
      )}
    </div>
  );
}

// ── Subcomponente de corrección ────────────────────────────────────────────────
function CorregirInput({
  label,
  defaultValue,
  onConfirm,
  tono,
}: {
  label:         string;
  defaultValue?: number;
  onConfirm:     (v: number) => Promise<void>;
  tono:          TonoHorometro;
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
          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-28 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
        />
        <button
          type="button"
          disabled={!val}
          onClick={() => { const n = parseFloat(val); if (!isNaN(n)) void onConfirm(n); }}
          className={`px-2.5 py-1.5 rounded-lg ${tono.boton} text-white text-xs font-semibold disabled:opacity-40 transition-colors`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
