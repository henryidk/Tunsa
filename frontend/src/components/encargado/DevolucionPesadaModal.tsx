import { useState, useEffect, useMemo } from 'react';
import { solicitudesService, type LecturaHorometro } from '../../services/solicitudes.service';
import { generarLiquidacion } from '../../utils/generarLiquidacion';
import { generarDetalleHorometro } from '../../utils/generarDetalleHorometro';
import { ultimoDiaHorometro, localDateOf } from '../../utils/horometro.utils';
import type { SolicitudRenta, DevolucionEntry } from '../../types/solicitud-renta.types';
import { useAuthStore, selectUser, selectUserRole } from '../../store/auth.store';
import {
  type DescuentoFormState,
  type DescuentoAplicado,
  DESCUENTO_INICIAL,
  calcularDescuento,
  descuentoEsValido,
} from '../../types/descuento.types';
import {
  type ItemRetorno,
  type CargoRow,
  type PasoKey,
  type PasoMeta,
  buildSecuencia,
  getPendientes,
  estimarLecturasConDevolucion,
  calcularResumenHorometroEstimado,
  calcularBloqueos,
} from './devolucion-pesada/types';
import PasoIndicador from './devolucion-pesada/PasoIndicador';
import PasoEquipos   from './devolucion-pesada/PasoEquipos';
import PasoCargos    from './devolucion-pesada/PasoCargos';
import PasoResumen   from './devolucion-pesada/PasoResumen';
import PasoConfirmar from './devolucion-pesada/PasoConfirmar';
import PasoResultado from './devolucion-pesada/PasoResultado';
import PasoDescuento from '../shared/PasoDescuento';

export default function DevolucionPesadaModal({
  solicitud,
  onClose,
  onDevolucion,
}: {
  solicitud:    SolicitudRenta;
  onClose:      () => void;
  onDevolucion: (actualizada: SolicitudRenta) => void;
}) {
  const rolNombre   = useAuthStore(selectUserRole);
  const currentUser = useAuthStore(selectUser);
  const pendientes = useMemo(() => getPendientes(solicitud), [solicitud]);
  const esItemUnico = pendientes.length === 1;

  const puedeDescuento = solicitud.cliente.esEspecial && (rolNombre === 'admin' || rolNombre === 'secretaria');

  const secuencia: PasoMeta[] = useMemo(
    () => buildSecuencia(puedeDescuento),
    [puedeDescuento],
  );

  const [paso,           setPaso]          = useState<PasoKey>('equipos');
  const [guardando,      setGuardando]     = useState(false);
  const [guardandoFase,  setGuardandoFase] = useState<'registrando' | 'documentos'>('registrando');
  const [error,          setError]         = useState<string | null>(null);
  const [resultado,      setResultado]     = useState<SolicitudRenta | null>(null);
  const [liquidacionUrl, setLiquidacionUrl] = useState<string | null>(null);
  const [detalleHorometroUrl, setDetalleHorometroUrl] = useState<string | null>(null);

  const [pdfBlobUrl,   setPdfBlobUrl]   = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError,     setPdfError]     = useState(false);

  const [lecturas,       setLecturas]       = useState<LecturaHorometro[]>([]);
  const [loadingLectura, setLoadingLectura] = useState(true);

  const [descuentoState, setDescuentoState] = useState<DescuentoFormState>(DESCUENTO_INICIAL);

  useEffect(() => {
    solicitudesService.getLecturas(solicitud.id)
      .then(setLecturas)
      .catch(() => {})
      .finally(() => setLoadingLectura(false));
  }, [solicitud.id]);

  const [items, setItems] = useState<ItemRetorno[]>(
    pendientes.map(p => ({
      equipoId:            p.equipoId,
      numeracion:          p.numeracion,
      descripcion:         p.descripcion,
      extras:              p.extras,
      tarifaEfectiva:      p.tarifaEfectiva,
      horometroInicial:    p.horometroInicial ?? null,
      horometroDevolucion: '',
      seleccionado:        esItemUnico,
    })),
  );

  const [hayCargos, setHayCargos] = useState(false);
  const [cargos,    setCargos]    = useState<CargoRow[]>([{ descripcion: '', monto: '' }]);

  const toggleItem = (equipoId: string) =>
    setItems(prev => prev.map(it => it.equipoId === equipoId ? { ...it, seleccionado: !it.seleccionado } : it));

  const setHorometro = (equipoId: string, val: string) =>
    setItems(prev => prev.map(it => it.equipoId === equipoId ? { ...it, horometroDevolucion: val } : it));

  const agregarCargo  = () => setCargos(prev => [...prev, { descripcion: '', monto: '' }]);
  const eliminarCargo = (idx: number) => setCargos(prev => prev.filter((_, i) => i !== idx));
  const actualizarCargo = (idx: number, campo: keyof CargoRow, valor: string) =>
    setCargos(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      if (campo === 'monto') {
        if (valor === '') return { ...c, monto: '' };
        const n = parseFloat(valor);
        return isNaN(n) || n < 0 ? c : { ...c, monto: n };
      }
      return { ...c, descripcion: valor };
    }));

  const seleccionados = items.filter(it => it.seleccionado);

  const fechaInicioStr = solicitud.fechaInicioRenta?.substring(0, 10) ?? '';
  const ayer = localDateOf(new Date(new Date().getTime() - 86_400_000));
  const ultimoDia = ultimoDiaHorometro(solicitud.fechaFinEstimada);
  const ultimoDiaObligatorio = ultimoDia <= ayer ? ultimoDia : ayer;

  const bloqueoItems = useMemo(
    () => calcularBloqueos(lecturas, seleccionados, fechaInicioStr, ultimoDiaObligatorio),
    [lecturas, seleccionados, fechaInicioStr, ultimoDiaObligatorio],
  );

  const minHorometroDevolucion = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const ultima = lecturas
        .filter(l => l.equipoId === it.equipoId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      if (ultima?.horometroFin5pm != null) map.set(it.equipoId, ultima.horometroFin5pm);
    }
    return map;
  }, [lecturas, items]);

  const paso1Valido = seleccionados.length > 0
    && bloqueoItems.size === 0
    && seleccionados.every(it => {
      if (it.horometroDevolucion === '') return false;
      const val = parseFloat(it.horometroDevolucion);
      if (isNaN(val)) return false;
      const min = minHorometroDevolucion.get(it.equipoId);
      return min == null || val >= min;
    });

  const cargosValidos  = !hayCargos ? [] : cargos.filter(c => c.descripcion.trim() !== '' && c.monto !== '' && (c.monto as number) > 0);
  const cargosConError = hayCargos && cargos.some(c => {
    const tieneDescripcion = c.descripcion.trim() !== '';
    const tieneMonto       = c.monto !== '' && Number(c.monto) > 0;
    return tieneDescripcion !== tieneMonto;
  });
  const totalCargosAd = cargosValidos.reduce((s, c) => s + (c.monto as number), 0);

  const costoAcumPorEquipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lecturas) map.set(l.equipoId, (map.get(l.equipoId) ?? 0) + (l.costoTotal ?? 0));
    return map;
  }, [lecturas]);

  const costoAcumTotal = seleccionados.reduce((s, it) => s + (costoAcumPorEquipo.get(it.equipoId) ?? 0), 0);

  const costoEstimadoPorEquipo = useMemo(() => {
    const sel = items.filter(it => it.seleccionado);
    const estimadas = estimarLecturasConDevolucion(lecturas, sel);
    const map = new Map<string, number>();
    for (const l of estimadas) map.set(l.equipoId, (map.get(l.equipoId) ?? 0) + (l.costoTotal ?? 0));
    return map;
  }, [lecturas, items]);

  const costoEstimadoTotal = seleccionados.reduce((s, it) => s + (costoEstimadoPorEquipo.get(it.equipoId) ?? 0), 0);
  const montoBaseDescuento = costoEstimadoTotal + totalCargosAd;

  const pasoIdx     = secuencia.findIndex(p => p.key === paso);
  const siguienteKey = pasoIdx >= 0 && pasoIdx < secuencia.length - 1 ? secuencia[pasoIdx + 1].key : null;
  const anteriorKey  = pasoIdx > 0 ? secuencia[pasoIdx - 1].key : null;

  const generarPdf = (descuentoAplicado: DescuentoAplicado | null) => {
    setGenerandoPdf(true);
    setPdfBlobUrl(null);
    setPdfError(false);

    const lecturasEstimadas = estimarLecturasConDevolucion(lecturas, seleccionados);
    const resumenEstimado   = calcularResumenHorometroEstimado(lecturasEstimadas, seleccionados);
    const totalBase         = costoEstimadoTotal + totalCargosAd;

    const devolucionPrevia: DevolucionEntry = {
      fechaDevolucion:     new Date().toISOString(),
      registradoPor:       currentUser?.nombre ?? '—',
      esParcial:           seleccionados.length < pendientes.length,
      tipoDevolucion:      'A_TIEMPO',
      items:               seleccionados.map(it => ({
        itemRef:       it.equipoId,
        kind:          'pesada' as const,
        diasCobrados:  0,
        costoReal:     costoEstimadoPorEquipo.get(it.equipoId) ?? 0,
        recargoTiempo: 0,
      })),
      recargosAdicionales: cargosValidos.map(c => ({ descripcion: c.descripcion, monto: c.monto as number })),
      descuento:           descuentoAplicado ?? undefined,
      totalLote:           descuentoAplicado ? descuentoAplicado.montoFinal : totalBase,
      liquidacionKey:      null,
    };
    generarLiquidacion(solicitud, devolucionPrevia, resumenEstimado)
      .then(blob => setPdfBlobUrl(URL.createObjectURL(blob)))
      .catch(() => setPdfError(true))
      .finally(() => setGenerandoPdf(false));
  };

  const irSiguiente = () => {
    if (paso === 'equipos' && !paso1Valido)   return;
    if (paso === 'cargos'  && cargosConError)  return;
    if (paso === 'descuento' && !descuentoEsValido(descuentoState, montoBaseDescuento)) return;

    if (paso === 'cargos') {
      if (siguienteKey !== 'descuento') {
        generarPdf(null);
      }
    }

    if (paso === 'descuento') {
      const descuentoAplicado = calcularDescuento(descuentoState, montoBaseDescuento);
      generarPdf(descuentoAplicado);
    }

    if (siguienteKey) setPaso(siguienteKey);
  };

  const irAtras = () => { if (anteriorKey) setPaso(anteriorKey); };

  const handleConfirmar = async () => {
    setError(null);
    setGuardandoFase('registrando');
    setGuardando(true);
    try {
      const descuentoPayload = descuentoState.aplicar && puedeDescuento
        ? calcularDescuento(descuentoState, montoBaseDescuento)
        : null;

      const actualizada = await solicitudesService.registrarDevolucionPesada(solicitud.id, {
        items: seleccionados.map(it => ({
          equipoId:            it.equipoId,
          horometroDevolucion: it.horometroDevolucion ? parseFloat(it.horometroDevolucion) : 0,
        })),
        recargosAdicionales: cargosValidos.length > 0
          ? cargosValidos.map(c => ({ descripcion: c.descripcion.trim(), monto: c.monto as number }))
          : undefined,
        descuento: descuentoPayload
          ? { tipo: descuentoPayload.tipo, valor: descuentoPayload.valor }
          : undefined,
      });

      let url: string | null = null;
      let urlDetalle: string | null = null;
      const devs       = actualizada.devolucionesParciales ?? [];
      const devolucion = devs[devs.length - 1] as DevolucionEntry | undefined;
      if (devolucion) {
        setGuardandoFase('documentos');
        try {
          // El resumen ya quedó calculado y guardado por el backend dentro de registrarDevolucionPesada()
          // — es la fuente de verdad agregada (entrega/devolución/diurnas/nocturnas/desglose por
          // complemento). El detalle día por día sí necesita el historial completo de lecturas,
          // porque ese es justamente el documento que lo preserva una vez la renta se cierra.
          const [resumenFinal, lecturasFinales] = await Promise.all([
            solicitudesService.getResumenHorometro(solicitud.id),
            solicitudesService.getLecturas(solicitud.id),
          ]);

          const [pdfLiquidacion, pdfDetalle] = await Promise.all([
            generarLiquidacion(actualizada, devolucion, resumenFinal),
            generarDetalleHorometro(actualizada, devolucion, lecturasFinales),
          ]);

          // Secuencial, NO Promise.all: ambos endpoints hacen "leer devolucionesParciales completo,
          // mutar un campo, escribir el array completo" sobre la MISMA fila. En paralelo, el segundo
          // en escribir pisa el campo que acababa de guardar el primero (lost update) — por eso solo
          // sobrevivía una de las dos keys.
          const liquidacionSubida = await solicitudesService.subirLiquidacion(solicitud.id, pdfLiquidacion);
          const detalleSubido     = await solicitudesService.subirDetalleHorometro(solicitud.id, pdfDetalle);
          url        = liquidacionSubida.url;
          urlDetalle = detalleSubido.url;
        } catch (err) {
          // No bloquear la devolución si algún PDF falla, pero sí dejar rastro del motivo
          console.error('Fallo al generar/subir liquidación o detalle de horómetro:', err);
        }
      }

      setResultado(actualizada);
      setLiquidacionUrl(url);
      setDetalleHorometroUrl(urlDetalle);
      setPaso('resultado');
      onDevolucion(actualizada);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la devolución.'));
    } finally {
      setGuardando(false);
    }
  };

  const descuentoAplicado: DescuentoAplicado | null = useMemo(
    () => (puedeDescuento ? calcularDescuento(descuentoState, montoBaseDescuento) : null),
    [puedeDescuento, descuentoState, montoBaseDescuento],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={paso !== 'resultado' ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar devolución</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Folio {solicitud.folio ?? solicitud.id.slice(0, 8)} — {solicitud.cliente.nombre}
            </p>
          </div>
          {paso !== 'resultado' && (
            <button onClick={onClose} disabled={guardando} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {paso !== 'resultado' && <PasoIndicador secuencia={secuencia} pasoActual={paso} />}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {paso === 'equipos' && (
            <PasoEquipos
              items={items}
              esItemUnico={esItemUnico}
              loadingLectura={loadingLectura}
              costoAcumPorEquipo={costoAcumPorEquipo}
              bloqueoItems={bloqueoItems}
              minHorometroDevolucion={minHorometroDevolucion}
              onToggle={toggleItem}
              onHorometro={setHorometro}
            />
          )}
          {paso === 'cargos' && (
            <PasoCargos
              hayCargos={hayCargos}
              onToggle={() => setHayCargos(p => !p)}
              cargos={cargos}
              totalCargosAd={totalCargosAd}
              onAgregar={agregarCargo}
              onEliminar={eliminarCargo}
              onActualizar={actualizarCargo}
            />
          )}
          {paso === 'descuento' && (
            <PasoDescuento
              montoBase={montoBaseDescuento}
              loadingMonto={loadingLectura}
              estado={descuentoState}
              onChange={setDescuentoState}
            />
          )}
          {paso === 'resumen' && (
            <PasoResumen
              solicitud={solicitud}
              seleccionados={seleccionados}
              cargosValidos={cargosValidos}
              costoAcumPorEquipo={costoAcumPorEquipo}
              costoEstimadoTotal={costoEstimadoTotal}
              totalCargosAd={totalCargosAd}
              descuento={descuentoAplicado ?? undefined}
              loadingLectura={loadingLectura}
              generandoPdf={generandoPdf}
              pdfBlobUrl={pdfBlobUrl}
              pdfError={pdfError}
            />
          )}
          {paso === 'confirmar' && (
            <PasoConfirmar
              seleccionados={seleccionados}
              cargosValidos={cargosValidos}
              totalCargosAd={totalCargosAd}
              descuento={descuentoAplicado ?? undefined}
            />
          )}
          {paso === 'resultado' && resultado && (
            <PasoResultado resultado={resultado} liquidacionUrl={liquidacionUrl} detalleHorometroUrl={detalleHorometroUrl} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex-shrink-0">
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          {paso === 'resultado' ? (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {anteriorKey ? (
                <button
                  onClick={irAtras}
                  disabled={guardando}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60"
                >
                  Atrás
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              )}

              {paso !== 'confirmar' ? (
                <button
                  onClick={irSiguiente}
                  disabled={
                    (paso === 'equipos'   && !paso1Valido) ||
                    (paso === 'cargos'    && cargosConError) ||
                    (paso === 'descuento' && !descuentoEsValido(descuentoState, montoBaseDescuento))
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleConfirmar}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardando ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                    </svg>
                  )}
                  {guardando
                    ? (guardandoFase === 'registrando' ? 'Registrando…' : 'Generando documentos…')
                    : 'Confirmar y registrar'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
