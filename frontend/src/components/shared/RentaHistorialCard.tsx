import { useState } from 'react';
import { solicitudesService, type ResumenHorometroEquipo } from '../../services/solicitudes.service';
import type { SolicitudRenta, DevolucionEntry } from '../../types/solicitud-renta.types';
import { formatFechaHora, formatQ } from '../../types/solicitud.types';
import ClienteNombre from './ClienteNombre';
import { resolverLabelItem } from '../../utils/devolucion.helpers';

function contarItemsPendientes(solicitud: SolicitudRenta): number {
  const yaDevueltos = new Set<string>(
    (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
  );
  return solicitud.items.filter(item => {
    const ref = item.kind === 'granel' ? item.tipo : item.equipoId;
    return !yaDevueltos.has(ref);
  }).length;
}

export interface RentaHistorialCardProps {
  solicitud:      SolicitudRenta;
  showEncargado?: boolean;
}

export default function RentaHistorialCard({ solicitud, showEncargado = false }: RentaHistorialCardProps) {
  const devuelto     = solicitud.estado === 'DEVUELTA';
  const pendientes   = devuelto ? 0 : contarItemsPendientes(solicitud);
  const devoluciones = solicitud.devolucionesParciales ?? [];
  const [abriendoComprobante, setAbriendoComprobante] = useState(false);

  const handleVerComprobante = async () => {
    setAbriendoComprobante(true);
    try {
      const { url } = await solicitudesService.getComprobanteUrl(solicitud.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso
    } finally {
      setAbriendoComprobante(false);
    }
  };

  const [mostrarHorometro, setMostrarHorometro] = useState(false);
  const [resumenHorometro, setResumenHorometro] = useState<ResumenHorometroEquipo[] | null>(null);
  const [cargandoHorometro, setCargandoHorometro] = useState(false);

  const handleToggleHorometro = async () => {
    if (mostrarHorometro) {
      setMostrarHorometro(false);
      return;
    }
    setMostrarHorometro(true);
    if (resumenHorometro) return;
    setCargandoHorometro(true);
    try {
      const data = await solicitudesService.getResumenHorometro(solicitud.id);
      setResumenHorometro(data);
    } catch {
      // silencioso
    } finally {
      setCargandoHorometro(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden border-l-4 ${
      devuelto ? 'border-l-emerald-500 border-slate-200' : 'border-l-amber-400 border-slate-200'
    }`}>

      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5 flex-wrap">
          {devuelto ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Devuelta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Renta abierta · {pendientes} {pendientes === 1 ? 'equipo pendiente' : 'equipos pendientes'}
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-600">{solicitud.folio}</span>
          {solicitud.comprobanteKey && (
            <button
              onClick={handleVerComprobante}
              disabled={abriendoComprobante}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-60"
            >
              {abriendoComprobante ? (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>
                </svg>
              )}
              Comprobante
            </button>
          )}
          {solicitud.esPesada && (
            <button
              onClick={handleToggleHorometro}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Desglose de horómetro {mostrarHorometro ? '▲' : '▼'}
            </button>
          )}
        </div>
        <div className="text-right">
          <ClienteNombre nombre={solicitud.cliente.nombre} esEspecial={solicitud.cliente.esEspecial} textCls="text-xs font-semibold text-slate-700" className="flex items-center gap-1.5 justify-end flex-wrap" />
          {showEncargado && (
            <p className="text-xs text-slate-400 font-mono">
              {solicitud.gestionadaPor
                ? (solicitud.nombreGestor ?? solicitud.gestionadaPor)
                : (solicitud.nombreCreador ?? solicitud.creadaPor)}
            </p>
          )}
          {devuelto && solicitud.totalFinal != null && (
            <p className="text-xs text-slate-500 font-mono">
              Total final: <span className="font-bold text-slate-800">{formatQ(solicitud.totalFinal)}</span>
            </p>
          )}
        </div>
      </div>

      {mostrarHorometro && (
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
          {cargandoHorometro ? (
            <p className="text-xs text-slate-400">Cargando desglose…</p>
          ) : !resumenHorometro || resumenHorometro.length === 0 ? (
            <p className="text-xs text-slate-400">No hay datos de horómetro para esta renta.</p>
          ) : (
            <div className="space-y-3">
              {resumenHorometro.map(eq => (
                <div key={eq.equipoId} className="text-xs">
                  <p className="font-semibold text-slate-700 mb-1">
                    {eq.numeracion ? `#${eq.numeracion}` : eq.equipoId} {eq.descripcion ? `— ${eq.descripcion}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-500 mb-1.5">
                    <span>Entrega: <span className="font-mono">{eq.horometroEntrega ?? '—'}</span></span>
                    <span>Devolución: <span className="font-mono">{eq.horometroDevolucion ?? '—'}</span></span>
                    <span>H. diurnas: <span className="font-mono">{eq.horasDiurnasTotal?.toFixed(1) ?? '—'}</span></span>
                    <span>H. nocturnas: <span className="font-mono">{eq.horasNocturnas?.toFixed(1) ?? '—'}</span></span>
                    {eq.ajusteMinimoTotal != null && eq.ajusteMinimoTotal > 0 && (
                      <span>Ajuste mínimo: <span className="font-mono">+{eq.ajusteMinimoTotal.toFixed(1)}</span></span>
                    )}
                  </div>
                  {eq.desgloseComplementos.length > 0 && (
                    <ul className="space-y-0.5 pl-3 border-l-2 border-amber-200">
                      {eq.desgloseComplementos.map((d, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className={d.extraId ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                            {d.extraId ? d.extraNombre : 'Sin complemento'}
                          </span>
                          <span className="font-mono text-slate-600">
                            {d.horas.toFixed(1)}h · {formatQ(d.costo)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {devoluciones.map((lote, idx) => (
          <LoteRow
            key={idx}
            solicitud={solicitud}
            lote={lote}
            loteIndex={idx}
            loteTotal={devoluciones.length}
          />
        ))}
      </div>

    </div>
  );
}

function LoteRow({
  solicitud,
  lote,
  loteIndex,
  loteTotal,
}: {
  solicitud:  SolicitudRenta;
  lote:       DevolucionEntry;
  loteIndex:  number;
  loteTotal:  number;
}) {
  const [abriendo, setAbriendo] = useState(false);

  const handleVerLiquidacion = async () => {
    setAbriendo(true);
    try {
      const { url } = await solicitudesService.getLiquidacionUrl(solicitud.id, loteIndex);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso — botón solo aparece si liquidacionKey existe
    } finally {
      setAbriendo(false);
    }
  };

  const esTardia = lote.tipoDevolucion === 'TARDIA';
  const numLote  = loteIndex + 1;

  return (
    <div className="px-5 py-4">

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Lote {numLote} {loteTotal > 1 ? `de ${loteTotal}` : ''}
          </span>
          {lote.esParcial && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
              Parcial
            </span>
          )}
          {esTardia && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
              Tardía
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {formatFechaHora(lote.fechaDevolucion)}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {lote.items.map((entry, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-slate-700 leading-snug">
              {resolverLabelItem(solicitud, entry)}
            </span>
            <div className="shrink-0 text-right">
              <span className="text-slate-500">
                {entry.diasCobrados} día{entry.diasCobrados !== 1 ? 's' : ''} · {formatQ(entry.costoReal)}
              </span>
              {entry.recargoTiempo > 0 && (
                <span className="block text-red-500 font-medium">
                  + recargo {formatQ(entry.recargoTiempo)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {lote.recargosAdicionales.length > 0 && (
        <div className="space-y-1 mb-3 pl-3 border-l-2 border-amber-200">
          {lote.recargosAdicionales.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-amber-700">{c.descripcion}</span>
              <span className="text-amber-700 font-medium">{formatQ(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {lote.descuento && (
        <div className="flex items-center justify-between mb-3 pl-3 border-l-2 border-indigo-200 text-xs">
          <span className="text-indigo-600 font-medium">
            Descuento{lote.descuento.tipo === 'porcentaje'
              ? ` (${lote.descuento.valor}%)`
              : ' (monto fijo)'}
          </span>
          <span className="text-indigo-600 font-medium">
            − {formatQ(lote.descuento.montoOriginal - lote.descuento.montoFinal)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-700">
          Total lote: <span className="font-mono">{formatQ(lote.totalLote)}</span>
        </span>
        {lote.liquidacionKey && (
          <button
            onClick={handleVerLiquidacion}
            disabled={abriendo}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-60"
          >
            {abriendo ? (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            )}
            Ver liquidación
          </button>
        )}
      </div>
    </div>
  );
}
