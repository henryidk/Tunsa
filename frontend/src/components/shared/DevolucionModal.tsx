import { useState, useMemo } from 'react';
import type { SolicitudRenta, ItemSnapshot, DevolucionEntry } from '../../types/solicitud-renta.types';
import { solicitudesService } from '../../services/solicitudes.service';
import { generarLiquidacion } from '../../utils/generarLiquidacion';
import { formatFechaHora, unidadLabel } from '../../types/solicitud.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemRef(item: ItemSnapshot): string {
  return item.kind === 'maquinaria' ? item.equipoId : item.tipo;
}

function itemLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria') return `#${item.numeracion} ${item.descripcion}`;
  return `${item.tipoLabel}${item.conMadera ? ' (c/madera)' : ''} × ${item.cantidad.toLocaleString('es-GT')}`;
}

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

function diasDesde(iso: string): number {
  return Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CargoRow {
  descripcion: string;
  monto:       number | '';
}

type Paso = 1 | 2 | 3 | 4 | 'resultado';

interface Resultado {
  solicitudActualizada: SolicitudRenta;
  devolucion:           DevolucionEntry;
  liquidacionUrl:       string | null;
}

// ── Paso indicator ────────────────────────────────────────────────────────────

function PasoIndicador({ paso }: { paso: Paso }) {
  const pasos      = [{ n: 1, label: 'Ítems' }, { n: 2, label: 'Cargos' }, { n: 3, label: 'Resumen' }, { n: 4, label: 'Confirmar' }];
  const pasoActual = paso === 'resultado' ? 4 : paso;
  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-100 bg-slate-50">
      {pasos.map((p, idx) => (
        <div key={p.n} className="flex items-center gap-1.5">
          {idx > 0 && <div className={`h-px w-6 ${pasoActual > p.n ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
          <div className={`flex items-center gap-1 ${pasoActual === p.n ? 'text-indigo-700' : pasoActual > p.n ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
              pasoActual > p.n
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : pasoActual === p.n
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
            }`}>
              {pasoActual > p.n
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : p.n}
            </span>
            <span className="text-[11px] font-semibold">{p.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DevolucionModal({
  solicitud,
  onClose,
  onDevolucion,
}: {
  solicitud:    SolicitudRenta;
  onClose:      () => void;
  onDevolucion: (actualizada: SolicitudRenta) => void;
}) {
  const itemsPendientes = useMemo(() => {
    const yaDevueltos = new Set<string>(
      (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
    );
    return solicitud.items.filter(item => !yaDevueltos.has(itemRef(item)));
  }, [solicitud]);

  const esItemUnico       = itemsPendientes.length === 1;
  const diasUso           = solicitud.fechaInicioRenta ? diasDesde(solicitud.fechaInicioRenta) : null;

  const [paso,      setPaso]      = useState<Paso>(1);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [pdfBlobUrl,   setPdfBlobUrl]   = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError,     setPdfError]     = useState(false);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set(esItemUnico ? [itemRef(itemsPendientes[0])] : []),
  );

  const [hayCargos,         setHayCargos]         = useState(false);
  const [cargosAdicionales, setCargosAdicionales] = useState<CargoRow[]>([{ descripcion: '', monto: '' }]);

  const toggleItem = (ref: string) =>
    setSeleccionados(prev => { const next = new Set(prev); if (next.has(ref)) next.delete(ref); else next.add(ref); return next; });

  const agregarCargo    = () => setCargosAdicionales(prev => [...prev, { descripcion: '', monto: '' }]);
  const eliminarCargo   = (idx: number) => setCargosAdicionales(prev => prev.filter((_, i) => i !== idx));
  const actualizarCargo = (idx: number, campo: keyof CargoRow, valor: string) =>
    setCargosAdicionales(prev =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        if (campo === 'monto') {
          if (valor === '') return { ...c, monto: '' };
          const n = parseFloat(valor);
          return isNaN(n) || n < 0 ? c : { ...c, monto: n };
        }
        return { ...c, descripcion: valor };
      }),
    );

  const itemsADevolver      = itemsPendientes.filter(item => seleccionados.has(itemRef(item)));
  const esDevolcionCompleta = seleccionados.size === itemsPendientes.length;

  const cargosValidos   = !hayCargos ? [] : cargosAdicionales.filter(c => c.descripcion.trim() !== '' && c.monto !== '' && c.monto > 0);
  const cargosConError  = hayCargos && cargosAdicionales.some(c => c.descripcion.trim() === '' && c.monto !== '');
  const totalCargosAd   = cargosValidos.reduce((s, c) => s + (c.monto as number), 0);
  const subtotalItems   = itemsADevolver.reduce((s, item) => s + (item.kind !== 'pesada' ? item.subtotal : 0), 0);

  const irSiguiente = () => {
    if (paso === 1 && seleccionados.size === 0) return;
    if (paso === 2 && cargosConError) return;

    if (paso === 2 && solicitud.fechaInicioRenta) {
      setGenerandoPdf(true);
      setPdfBlobUrl(null);
      setPdfError(false);
      const diasCobrados = diasDesde(solicitud.fechaInicioRenta);
      const devolucionPrevia: DevolucionEntry = {
        fechaDevolucion:     new Date().toISOString(),
        registradoPor:       '—',
        esParcial:           !esDevolcionCompleta,
        tipoDevolucion:      'A_TIEMPO',
        items:               itemsADevolver.map(item => ({
          itemRef:       itemRef(item),
          kind:          item.kind as 'maquinaria' | 'granel' | 'pesada',
          diasCobrados,
          costoReal:     item.kind !== 'pesada' ? item.subtotal : 0,
          recargoTiempo: 0,
        })),
        recargosAdicionales: cargosValidos.map(c => ({ descripcion: c.descripcion, monto: c.monto as number })),
        totalLote:           subtotalItems + totalCargosAd,
        liquidacionKey:      null,
      };
      generarLiquidacion(solicitud, devolucionPrevia)
        .then(blob => setPdfBlobUrl(URL.createObjectURL(blob)))
        .catch(() => setPdfError(true))
        .finally(() => setGenerandoPdf(false));
    }

    setPaso(p => (p as number) + 1 as Paso);
  };

  const handleConfirmar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const dto = {
        itemRefs: esDevolcionCompleta ? undefined : itemsADevolver.map(itemRef),
        recargosAdicionales: cargosValidos.length > 0
          ? cargosValidos.map(c => ({ descripcion: c.descripcion.trim(), monto: c.monto as number }))
          : undefined,
      };

      const solicitudActualizada = await solicitudesService.registrarDevolucion(solicitud.id, dto);
      const devoluciones         = solicitudActualizada.devolucionesParciales ?? [];
      const devolucion           = devoluciones[devoluciones.length - 1];
      if (!devolucion) throw new Error('No se recibió confirmación del servidor.');

      let liquidacionUrl: string | null = null;
      try {
        const pdfBlob        = await generarLiquidacion(solicitudActualizada, devolucion);
        const { url }        = await solicitudesService.subirLiquidacion(solicitud.id, pdfBlob);
        liquidacionUrl       = url;
      } catch {
        // No bloquear la devolución si el PDF falla
      }

      setResultado({ solicitudActualizada, devolucion, liquidacionUrl });
      setPaso('resultado');
      onDevolucion(solicitudActualizada);
    } catch {
      setError('No se pudo registrar la devolución. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar devolución</h2>
            <p className="text-xs text-slate-500 mt-0.5">Folio {solicitud.folio} — {solicitud.cliente.nombre}</p>
          </div>
          {paso !== 'resultado' && (
            <button onClick={onClose} disabled={guardando} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {paso !== 'resultado' && <PasoIndicador paso={paso} />}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── PASO 1: Ítems ────────────────────────────────────────────── */}
          {paso === 1 && (
            <div className="space-y-4">
              {esDevolcionCompleta && !esItemUnico && (
                <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
                  <svg className="shrink-0 mt-0.5 text-emerald-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Todos los ítems seleccionados — se registrará como devolución completa.
                </div>
              )}
              {esItemUnico ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Ítem a devolver</p>
                  <p className="text-sm font-semibold text-slate-800">{itemLabel(itemsPendientes[0])}</p>
                  {solicitud.fechaInicioRenta && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Inicio: {formatFechaHora(solicitud.fechaInicioRenta)}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Selecciona los ítems que el cliente está devolviendo. Si son todos, se registrará la renta como completada.
                  </p>
                  <div className="space-y-2">
                    {itemsPendientes.map(item => {
                      const ref     = itemRef(item);
                      const checked = seleccionados.has(ref);
                      return (
                        <label key={ref} className={`flex items-start gap-3 border rounded-xl p-3.5 cursor-pointer transition-colors ${checked ? 'border-slate-700 bg-slate-800/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleItem(ref)} className="mt-0.5 accent-slate-800 w-4 h-4 cursor-pointer" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-tight">{itemLabel(item)}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.kind !== 'pesada' ? unidadLabel(item.duracion, item.unidad) : 'Por horómetro'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PASO 2: Cargos ───────────────────────────────────────────── */}
          {paso === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Registra cargos adicionales por daños, faltantes u otras condiciones del equipo. Estos se suman al costo calculado de la renta.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setHayCargos(p => !p)} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${hayCargos ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hayCargos ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">{hayCargos ? 'Hay cargos adicionales' : 'Sin cargos adicionales'}</span>
              </label>
              {hayCargos && (
                <div className="space-y-3">
                  {cargosAdicionales.map((cargo, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Descripción</label>
                        <input type="text" value={cargo.descripcion} onChange={e => actualizarCargo(idx, 'descripcion', e.target.value)} placeholder="Ej: Daño en panel lateral" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder-slate-300" />
                      </div>
                      <div className="w-28">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Monto (Q)</label>
                        <input type="number" min={0} step="0.01" value={cargo.monto} onChange={e => actualizarCargo(idx, 'monto', e.target.value)} placeholder="0.00" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      </div>
                      {cargosAdicionales.length > 1 && (
                        <button onClick={() => eliminarCargo(idx)} className="mb-0.5 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={agregarCargo} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar cargo
                  </button>
                  {totalCargosAd > 0 && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-slate-500 font-medium">Total cargos adicionales</span>
                      <span className="text-sm font-bold text-slate-800">{formatQ(totalCargosAd)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3: Resumen ──────────────────────────────────────────── */}
          {paso === 3 && (
            <div className="space-y-4">

              {/* Período */}
              {solicitud.fechaInicioRenta && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Período de renta</p>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex-1">
                      <p className="text-slate-400 mb-0.5">Inicio</p>
                      <p className="font-semibold text-slate-700">{formatFechaHora(solicitud.fechaInicioRenta)}</p>
                    </div>
                    <svg className="text-slate-300 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                    <div className="flex-1">
                      <p className="text-slate-400 mb-0.5">Devolución</p>
                      <p className="font-semibold text-slate-700">{formatFechaHora(new Date().toISOString())}</p>
                    </div>
                  </div>
                  {diasUso !== null && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-2">
                      {diasUso} día{diasUso !== 1 ? 's' : ''} de uso
                    </p>
                  )}
                </div>
              )}

              {/* Ítems */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {esDevolcionCompleta ? 'Devolución completa' : `Devolución parcial — ${itemsADevolver.length} ítem${itemsADevolver.length > 1 ? 's' : ''}`}
                </p>
                <ul className="space-y-1.5">
                  {itemsADevolver.map(item => (
                    <li key={itemRef(item)} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{itemLabel(item)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.kind !== 'pesada' ? unidadLabel(item.duracion, item.unidad) : 'Por horómetro'}
                          </p>
                        </div>
                      </div>
                      {item.kind !== 'pesada' && item.subtotal > 0 && (
                        <span className="text-xs font-mono font-semibold text-slate-600 flex-shrink-0">{formatQ(item.subtotal)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cargos adicionales */}
              {cargosValidos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Cargos adicionales</p>
                  <ul className="space-y-1">
                    {cargosValidos.map((c, i) => (
                      <li key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-700">{c.descripcion}</span>
                        <span className="text-xs font-bold text-amber-700">{formatQ(c.monto as number)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estimado */}
              {(subtotalItems > 0 || totalCargosAd > 0) && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Referencia estimada</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Basada en contrato original{cargosValidos.length > 0 ? ' + cargos' : ''}. El sistema ajusta según días reales al confirmar.
                    </p>
                  </div>
                  <span className="text-lg font-bold text-slate-700 font-mono">{formatQ(subtotalItems + totalCargosAd)}</span>
                </div>
              )}

              {/* Liquidación previa */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Documento de liquidación</p>
                {generandoPdf ? (
                  <div className="flex items-center gap-2 py-0.5">
                    <svg className="animate-spin text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span className="text-xs text-slate-500">Generando documento…</span>
                  </div>
                ) : pdfBlobUrl ? (
                  <a
                    href={pdfBlobUrl}
                    download={`liquidacion-${solicitud.folio ?? solicitud.id.slice(0, 8)}.pdf`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    Descargar liquidación
                  </a>
                ) : pdfError ? (
                  <p className="text-xs text-slate-400">No se pudo generar el documento.</p>
                ) : null}
              </div>
            </div>
          )}

          {/* ── PASO 4: Confirmar ────────────────────────────────────────── */}
          {paso === 4 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Esta acción <span className="font-semibold">no se puede revertir</span>. El monto final se calculará de forma adaptativa en base a los días reales de uso.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {esDevolcionCompleta ? 'Devolución completa' : `Devolución parcial — ${itemsADevolver.length} ítem${itemsADevolver.length > 1 ? 's' : ''}`}
                </p>
                <ul className="space-y-1.5">
                  {itemsADevolver.map(item => (
                    <li key={itemRef(item)} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                      <svg className="shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                      <span className="text-xs font-medium text-slate-800">{itemLabel(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {cargosValidos.length > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                  <span className="text-xs text-slate-600">
                    {cargosValidos.length} cargo{cargosValidos.length > 1 ? 's' : ''} adicional{cargosValidos.length > 1 ? 'es' : ''}
                  </span>
                  <span className="text-xs font-bold text-amber-700">{formatQ(totalCargosAd)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── RESULTADO ───────────────────────────────────────────────── */}
          {paso === 'resultado' && resultado && (
            <div className="space-y-4 py-1">
              {/* Banner éxito */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg className="text-emerald-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Devolución registrada</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {resultado.devolucion.esParcial
                      ? 'Devolución parcial completada. La renta sigue activa con los equipos pendientes.'
                      : 'Renta completada y cerrada.'}
                  </p>
                </div>
              </div>

              {/* Resumen de cobro */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Resumen de cobro</p>
                {resultado.devolucion.items.map((entry, i) => {
                  const item = solicitud.items.find(it => itemRef(it) === entry.itemRef);
                  return (
                    <div key={i} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-slate-600 leading-snug">{item ? itemLabel(item) : entry.itemRef}</span>
                      <div className="text-right shrink-0">
                        <div className="text-slate-500">{entry.diasCobrados} día{entry.diasCobrados !== 1 ? 's' : ''} — {formatQ(entry.costoReal)}</div>
                        {entry.recargoTiempo > 0 && <div className="text-amber-600">+ recargo {formatQ(entry.recargoTiempo)}</div>}
                      </div>
                    </div>
                  );
                })}
                {resultado.devolucion.recargosAdicionales.length > 0 && (
                  <>
                    <div className="border-t border-slate-200 my-1" />
                    {resultado.devolucion.recargosAdicionales.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-amber-700">{c.descripcion}</span>
                        <span className="text-amber-700 font-medium">{formatQ(c.monto)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Total este lote</span>
                  <span className="text-sm font-bold text-slate-800">{formatQ(resultado.devolucion.totalLote)}</span>
                </div>
              </div>

              {/* Liquidación PDF */}
              {resultado.liquidacionUrl ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Documento de liquidación</p>
                  <a
                    href={resultado.liquidacionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    Ver liquidación completa
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <svg className="text-slate-400 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-slate-500">El documento de liquidación no está disponible por el momento. Puedes descargarlo desde el historial.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex-shrink-0">
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          {paso === 'resultado' ? (
            <button onClick={onClose} className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
              Cerrar
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {paso > 1 ? (
                <button onClick={() => setPaso(p => (p as number) - 1 as Paso)} disabled={guardando} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60">
                  Atrás
                </button>
              ) : (
                <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
                  Cancelar
                </button>
              )}
              {paso < 4 ? (
                <button
                  onClick={irSiguiente}
                  disabled={(paso === 1 && seleccionados.size === 0) || (paso === 2 && cargosConError)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ) : (
                <button onClick={handleConfirmar} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {guardando
                    ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>}
                  {guardando ? 'Registrando…' : 'Confirmar y registrar'}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
