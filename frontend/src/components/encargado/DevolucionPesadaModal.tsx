import { useState, useEffect, useMemo } from 'react';
import { solicitudesService, type LecturaHorometro } from '../../services/solicitudes.service';
import { generarLiquidacion } from '../../utils/generarLiquidacion';
import type { SolicitudRenta, DevolucionEntry } from '../../types/solicitud-renta.types';
import { type ItemRetorno, type CargoRow, type Paso, getPendientes, estimarLecturasConDevolucion, calcularBloqueos } from './devolucion-pesada/types';
import PasoIndicador from './devolucion-pesada/PasoIndicador';
import PasoEquipos   from './devolucion-pesada/PasoEquipos';
import PasoCargos    from './devolucion-pesada/PasoCargos';
import PasoResumen   from './devolucion-pesada/PasoResumen';
import PasoConfirmar from './devolucion-pesada/PasoConfirmar';
import PasoResultado from './devolucion-pesada/PasoResultado';

export default function DevolucionPesadaModal({
  solicitud,
  onClose,
  onDevolucion,
}: {
  solicitud:    SolicitudRenta;
  onClose:      () => void;
  onDevolucion: (actualizada: SolicitudRenta) => void;
}) {
  const pendientes  = useMemo(() => getPendientes(solicitud), [solicitud]);
  const esItemUnico = pendientes.length === 1;

  const [paso,           setPaso]          = useState<Paso>(1);
  const [guardando,      setGuardando]     = useState(false);
  const [error,          setError]         = useState<string | null>(null);
  const [resultado,      setResultado]     = useState<SolicitudRenta | null>(null);
  const [liquidacionUrl, setLiquidacionUrl] = useState<string | null>(null);

  const [pdfBlobUrl,   setPdfBlobUrl]   = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError,     setPdfError]     = useState(false);

  const [lecturas,       setLecturas]       = useState<LecturaHorometro[]>([]);
  const [loadingLectura, setLoadingLectura] = useState(true);

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
      conMartillo:         p.conMartillo,
      tarifaEfectiva:      p.tarifaEfectiva,
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

  const bloqueoItems = useMemo(
    () => calcularBloqueos(lecturas, seleccionados),
    [lecturas, seleccionados],
  );

  const paso1Valido = seleccionados.length > 0
    && seleccionados.every(it => it.horometroDevolucion !== '')
    && bloqueoItems.size === 0;
  const cargosValidos  = !hayCargos ? [] : cargos.filter(c => c.descripcion.trim() !== '' && c.monto !== '' && (c.monto as number) > 0);
  const cargosConError = hayCargos && cargos.some(c => c.descripcion.trim() === '' && c.monto !== '');
  const totalCargosAd  = cargosValidos.reduce((s, c) => s + (c.monto as number), 0);

  const costoAcumPorEquipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lecturas) map.set(l.equipoId, (map.get(l.equipoId) ?? 0) + (l.costoTotal ?? 0));
    return map;
  }, [lecturas]);

  const costoAcumTotal = seleccionados.reduce((s, it) => s + (costoAcumPorEquipo.get(it.equipoId) ?? 0), 0);

  // Costo estimado incluyendo el efecto del horometroDevolucion de cada equipo seleccionado
  const costoEstimadoPorEquipo = useMemo(() => {
    const sel = items.filter(it => it.seleccionado);
    const estimadas = estimarLecturasConDevolucion(lecturas, sel);
    const map = new Map<string, number>();
    for (const l of estimadas) map.set(l.equipoId, (map.get(l.equipoId) ?? 0) + (l.costoTotal ?? 0));
    return map;
  }, [lecturas, items]);

  const costoEstimadoTotal = seleccionados.reduce((s, it) => s + (costoEstimadoPorEquipo.get(it.equipoId) ?? 0), 0);

  const irSiguiente = () => {
    if (paso === 1 && !paso1Valido)    return;
    if (paso === 2 && cargosConError)  return;

    if (paso === 2) {
      setGenerandoPdf(true);
      setPdfBlobUrl(null);
      setPdfError(false);

      const lecturasEstimadas = estimarLecturasConDevolucion(lecturas, seleccionados);

      const devolucionPrevia: DevolucionEntry = {
        fechaDevolucion:     new Date().toISOString(),
        registradoPor:       '—',
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
        totalLote:           costoEstimadoTotal + totalCargosAd,
        liquidacionKey:      null,
      };
      generarLiquidacion(solicitud, devolucionPrevia, lecturasEstimadas)
        .then(blob => setPdfBlobUrl(URL.createObjectURL(blob)))
        .catch(() => setPdfError(true))
        .finally(() => setGenerandoPdf(false));
    }

    setPaso(p => (p as number) + 1 as Paso);
  };

  const irAtras = () => setPaso(p => (p as number) - 1 as Paso);

  const handleConfirmar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const actualizada = await solicitudesService.registrarDevolucionPesada(solicitud.id, {
        items: seleccionados.map(it => ({
          equipoId:            it.equipoId,
          horometroDevolucion: it.horometroDevolucion ? parseFloat(it.horometroDevolucion) : 0,
        })),
        recargosAdicionales: cargosValidos.length > 0
          ? cargosValidos.map(c => ({ descripcion: c.descripcion.trim(), monto: c.monto as number }))
          : undefined,
      });

      let url: string | null = null;
      const devs      = actualizada.devolucionesParciales ?? [];
      const devolucion = devs[devs.length - 1] as DevolucionEntry | undefined;
      if (devolucion) {
        try {
          const lecturasActualizadas = await solicitudesService.getLecturas(solicitud.id);
          const pdfBlob = await generarLiquidacion(actualizada, devolucion, lecturasActualizadas);
          const { url: uploadedUrl } = await solicitudesService.subirLiquidacion(solicitud.id, pdfBlob);
          url = uploadedUrl;
        } catch {
          // No bloquear la devolución si el PDF falla
        }
      }

      setResultado(actualizada);
      setLiquidacionUrl(url);
      setPaso('resultado');
      onDevolucion(actualizada);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la devolución.'));
    } finally {
      setGuardando(false);
    }
  };

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

        {paso !== 'resultado' && <PasoIndicador paso={paso} />}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {paso === 1 && (
            <PasoEquipos
              items={items}
              esItemUnico={esItemUnico}
              loadingLectura={loadingLectura}
              costoAcumPorEquipo={costoAcumPorEquipo}
              bloqueoItems={bloqueoItems}
              onToggle={toggleItem}
              onHorometro={setHorometro}
            />
          )}
          {paso === 2 && (
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
          {paso === 3 && (
            <PasoResumen
              solicitud={solicitud}
              seleccionados={seleccionados}
              cargosValidos={cargosValidos}
              costoAcumPorEquipo={costoAcumPorEquipo}
              costoEstimadoTotal={costoEstimadoTotal}
              totalCargosAd={totalCargosAd}
              loadingLectura={loadingLectura}
              generandoPdf={generandoPdf}
              pdfBlobUrl={pdfBlobUrl}
              pdfError={pdfError}
            />
          )}
          {paso === 4 && (
            <PasoConfirmar
              seleccionados={seleccionados}
              cargosValidos={cargosValidos}
              totalCargosAd={totalCargosAd}
            />
          )}
          {paso === 'resultado' && resultado && (
            <PasoResultado resultado={resultado} liquidacionUrl={liquidacionUrl} />
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
              {paso > 1 ? (
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

              {paso < 4 ? (
                <button
                  onClick={irSiguiente}
                  disabled={(paso === 1 && !paso1Valido) || (paso === 2 && cargosConError)}
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
