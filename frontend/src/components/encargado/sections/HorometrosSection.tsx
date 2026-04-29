import { useState, useEffect, useCallback } from 'react';
import { solicitudesService, type LecturaHorometro } from '../../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import { formatQ } from '../../../types/solicitud.types';
import {
  today, getDiaStatus, generarDias,
  formatFechaCorta, type DiaStatus,
} from '../../../utils/horometro.utils';
import HorometroRentaCard from '../HorometroRentaCard';
import CalendarioMes from '../CalendarioMes';

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

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
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export default function HorometrosSection({ initialSolicitudId, fetchSolicitudes }: HorometrosSectionProps) {
  const hoy = today();
  const [solicitudes,   setSolicitudes]   = useState<SolicitudRenta[]>([]);
  const [lecturasMap,   setLecturasMap]   = useState<Record<string, LecturaHorometro[]>>({});
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError,     setListError]     = useState<string | null>(null);

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
    tipo:     'inicio' | 'fin5pm';
    valorNum: number;
    fecha:    string;
  } | null>(null);

  const resolvedFetch = fetchSolicitudes ?? fetchSolicitudesEncargado;

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
    setFechaActiva(hoy);
    setValor('');
    setSubmitError(null);
  }, [selectedId, solicitudes]);

  const refreshLecturas = useCallback(async (solicitudId: string) => {
    const l = await solicitudesService.getLecturas(solicitudId);
    setLecturasMap(prev => ({ ...prev, [solicitudId]: l }));
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
    ? selectedSol.fechaInicioRenta.substring(0, 10)
    : hoy;

  // Month navigation constraints
  const minMes = {
    año: parseInt(fechaInicioStr.substring(0, 4)),
    mes: parseInt(fechaInicioStr.substring(5, 7)) - 1,
  };
  const maxMes = { año: new Date().getFullYear(), mes: new Date().getMonth() };
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
      if (date < fechaInicioStr || date > hoy) continue;
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

  const handleSelectDia = (d: string) => { setFechaActiva(d); setValor(''); setSubmitError(null); };

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
    setSubmitError(null);
    setPendingConfirm({ tipo: tipoPendiente, valorNum, fecha: fechaActiva });
  };

  // Ejecuta el envío real tras confirmar en el modal
  const confirmarLectura = async () => {
    if (!pendingConfirm || !selectedId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setPendingConfirm(null);
    try {
      await solicitudesService.registrarLectura(selectedId, {
        equipoId: activeEquipo,
        fecha:    pendingConfirm.fecha,
        tipo:     pendingConfirm.tipo,
        valor:    pendingConfirm.valorNum,
      });
      setValor('');
      await refreshLecturas(selectedId);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la lectura.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pending-today count for list-view banner.
  // Prefer lecturasMap (updated after each registration) over the stale ultimaLectura snapshot.
  const pendientesHoy = solicitudes.filter(s => {
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
                onClick={() => { setActiveEquipo(item.equipoId); setValor(''); setFechaActiva(hoy); setSubmitError(null); }}
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
          <div className="flex flex-wrap items-center gap-6 mb-6 px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Equipo</p>
              <p className="font-semibold text-slate-800">
                <span className="font-mono text-slate-400 mr-1">#{activeItem.numeracion}</span>
                {activeItem.descripcion}
              </p>
            </div>
            {activeItem.horometroInicial != null && (
              <div className="border-l border-slate-200 pl-6">
                <p className="text-[10px] text-slate-400">Entrega al cliente</p>
                <p className="font-bold font-mono text-amber-700">
                  {activeItem.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })} hrs
                </p>
              </div>
            )}
            <div className="border-l border-slate-200 pl-6">
              <p className="text-[10px] text-slate-400">Tarifa</p>
              <p className="font-bold text-slate-700">{formatQ(activeItem.tarifaEfectiva)}/hr</p>
            </div>
            <div className="border-l border-slate-200 pl-6 ml-auto">
              <p className="text-[10px] text-slate-400">Inicio de renta</p>
              <p className="font-medium text-slate-600 font-mono">
                {fechaInicioStr.split('-').reverse().join('/')}
              </p>
            </div>
            {selectedSol.fechaFinEstimada && (
              <div className="border-l border-slate-200 pl-6">
                <p className="text-[10px] text-slate-400">Fin estimado</p>
                <p className={`font-medium font-mono ${new Date(selectedSol.fechaFinEstimada) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                  {selectedSol.fechaFinEstimada.substring(0, 10).split('-').reverse().join('/')}
                </p>
              </div>
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
                  <p className="text-[10px] text-slate-400">Completos</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600">{diasParciales}</p>
                  <p className="text-[10px] text-slate-400">Solo inicio</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">{diasSinRegistro}</p>
                  <p className="text-[10px] text-slate-400">Sin registro</p>
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
                  <label className="text-[11px] font-medium text-slate-500">Fecha</label>
                  <input
                    type="date"
                    value={fechaActiva}
                    onChange={e => handleSelectDia(e.target.value)}
                    max={hoy}
                    min={fechaInicioStr}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mb-3">
                {formatFechaCorta(fechaActiva)}
                {fechaActiva === hoy && ' · hoy'}
              </p>

              {fechaActiva > hoy ? (
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
                    className="ml-auto text-[11px] text-slate-500 underline hover:text-slate-700"
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
                        setIsSubmitting(true); setSubmitError(null);
                        try {
                          await solicitudesService.registrarLectura(selectedId, {
                            equipoId: activeEquipo, fecha: fechaActiva, tipo: 'inicio', valor: v,
                          });
                          await refreshLecturas(selectedId); setValor('');
                        } catch (err: unknown) {
                          const msg = (err as any)?.response?.data?.message;
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
                          const msg = (err as any)?.response?.data?.message;
                          setSubmitError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al corregir.'));
                        } finally { setIsSubmitting(false); }
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => setValor('')} className="text-[11px] text-slate-400 underline">
                    Cancelar
                  </button>
                </div>
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
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      {tipoPendiente === 'inicio' ? 'Horómetro de inicio' : 'Horómetro de cierre (5PM)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      placeholder="Ej: 1234.5"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      required
                      autoFocus
                    />
                  </div>
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
                              <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">entrega</span>
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-700">
                              {activeItem.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })}
                            </td>
                            <td colSpan={5} className="px-3 py-2 text-[11px] text-slate-400 italic">
                              Horómetro al momento de entrega al cliente
                            </td>
                          </tr>
                        )}

                        {lecturasDelMes.map(l => (
                          <tr
                            key={l.id}
                            onClick={() => handleSelectDia(l.fecha)}
                            className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors ${l.fecha === fechaActiva ? 'bg-indigo-50' : ''}`}
                          >
                            <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                              {formatFechaCorta(l.fecha)}
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
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {lecturasDelMes.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Subtotal mes</p>
                        <p className="text-base font-bold text-slate-800">
                          {formatQ(lecturasDelMes.reduce((s, l) => s + (l.costoTotal ?? 0), 0))}
                        </p>
                      </div>
                    </div>
                  )}
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
                  <p className="text-sm font-bold text-slate-800">Confirmar lectura</p>
                  <p className="text-xs text-slate-500">
                    {pendingConfirm.tipo === 'inicio' ? 'Horómetro de inicio' : 'Horómetro de cierre (5PM)'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Fecha</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {formatFechaCorta(pendingConfirm.fecha)}
                    {pendingConfirm.fecha === hoy && <span className="ml-1.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">hoy</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {pendingConfirm.tipo === 'inicio' ? 'Valor inicio' : 'Valor cierre'}
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
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Horómetros</h1>
        <p className="text-sm text-slate-500 mt-1">Registro diario de horas de maquinaria pesada en renta</p>
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
      ) : solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="text-sm font-medium">Sin rentas pesadas activas</p>
          <p className="text-xs text-center max-w-xs leading-relaxed">
            Las rentas pesadas activas aparecerán aquí para registrar las lecturas diarias.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudes.map(s => (
            <HorometroRentaCard
              key={s.id}
              solicitud={s}
              lecturas={lecturasMap[s.id] ?? null}
              onVerDetalle={() => setSelectedId(s.id)}
              onRegistrar={() => setSelectedId(s.id)}
            />
          ))}
        </div>
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
      <label className="text-[11px] font-medium text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="number"
          min="0"
          step="0.1"
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
