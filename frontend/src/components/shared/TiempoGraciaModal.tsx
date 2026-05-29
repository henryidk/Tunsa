import { useMemo, useState } from 'react';
import type { SolicitudRenta, ItemSnapshot, ExtensionEntry } from '../../types/solicitud-renta.types';
import { solicitudesService, type ExtensionItemPayload } from '../../services/solicitudes.service';
import { calcularFinConExtensiones } from '../../utils/renta-tiempo.utils';

function itemRef(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria' || item.kind === 'pesada') return item.equipoId;
  return item.tipo;
}

function itemLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria') return `#${item.numeracion} ${item.descripcion}`;
  if (item.kind === 'pesada')     return `#${item.numeracion} ${item.descripcion}${item.extras.length > 0 ? ' ' + item.extras.map(e => `+${e.nombre}`).join(', ') : ''}`;
  return `${item.tipoLabel}${item.conMadera ? ' (c/madera)' : ''} × ${item.cantidad.toLocaleString('es-GT')}`;
}

function formatFechaCorta(d: Date): string {
  return d.toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TiempoGraciaModal({
  solicitud,
  onClose,
  onGracia,
}: {
  solicitud: SolicitudRenta;
  onClose:   () => void;
  onGracia:  (actualizada: SolicitudRenta) => void;
}) {
  const ahora       = useMemo(() => Date.now(), []);
  const inicio      = useMemo(
    () => solicitud.fechaInicioRenta ? new Date(solicitud.fechaInicioRenta) : new Date(),
    [solicitud.fechaInicioRenta],
  );
  const extensiones = solicitud.extensiones ?? [];

  const { vencidos, activos } = useMemo(() => {
    const vencidos: ItemSnapshot[] = [];
    const activos:  ItemSnapshot[] = [];
    for (const item of solicitud.items) {
      const fin = calcularFinConExtensiones(inicio, item, extensiones);
      if (fin.getTime() < ahora) vencidos.push(item);
      else                       activos.push(item);
    }
    return { vencidos, activos };
  }, [solicitud.items, inicio, extensiones, ahora]);

  const [horas,       setHoras]       = useState<number | ''>('');
  const [confirmando, setConfirmando] = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const horasValidas = horas !== '' && horas >= 1;

  const handleHoras = (raw: string) => {
    if (raw === '') { setHoras(''); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setHoras(n);
  };

  const handleConfirmar = async () => {
    if (!horasValidas) return;
    setError(null);
    setGuardando(true);
    try {
      const items: ExtensionItemPayload[] = vencidos.map(item => ({
        itemRef:  itemRef(item),
        kind:     item.kind,
        duracion: horas as number,
        unidad:   'horas' as const,
      }));
      const actualizada = await solicitudesService.ampliar(solicitud.id, items, true);
      onGracia(actualizada);
    } catch {
      setError('No se pudo aplicar el tiempo de gracia. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Tiempo de gracia</h2>
            <p className="text-xs text-slate-500 mt-0.5">Folio {solicitud.folio}</p>
          </div>
          <button onClick={() => confirmando ? setConfirmando(false) : onClose()} disabled={guardando} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {confirmando ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Esta acción <span className="font-semibold">no se puede revertir</span>. El tiempo de gracia quedará registrado sin costo adicional.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Tiempo a aplicar</p>
                <ul className="space-y-2">
                  {vencidos.map(item => (
                    <li key={itemRef(item)} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-sm text-slate-800 truncate mr-3">{itemLabel(item)}</span>
                      <span className="text-sm font-semibold text-amber-700 shrink-0">+{horas}h de gracia</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Extiende el tiempo sin cargo adicional para los equipos vencidos.
              </p>

              {/* Equipos vencidos */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">
                  Vencidos ({vencidos.length})
                </p>
                {vencidos.map(item => {
                  const fin = calcularFinConExtensiones(inicio, item, extensiones);
                  return (
                    <div key={itemRef(item)} className="border border-red-200 bg-red-50/40 rounded-xl px-4 py-3">
                      <p className="text-sm font-medium text-slate-800 leading-tight">{itemLabel(item)}</p>
                      <p className="text-[11px] text-red-500 mt-0.5">Venció {formatFechaCorta(fin)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Input único de horas */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Horas adicionales{vencidos.length > 1 ? ' (para todos)' : ''}
                </label>
                <input
                  type="number" min={1} value={horas} onChange={e => handleHoras(e.target.value)} placeholder="Ej. 2"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* Equipos activos (contexto) */}
              {activos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Aún activos ({activos.length})</p>
                  {activos.map(item => {
                    const fin = calcularFinConExtensiones(inicio, item, extensiones);
                    return (
                      <div key={itemRef(item)} className="border border-slate-200 rounded-xl px-4 py-3 opacity-60">
                        <p className="text-sm font-medium text-slate-700 leading-tight">{itemLabel(item)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Vence {formatFechaCorta(fin)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {confirmando ? (
              <>
                <button onClick={() => setConfirmando(false)} disabled={guardando} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60">Volver</button>
                <button onClick={handleConfirmar} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {guardando && <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                  Sí, aplicar gracia
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">Cancelar</button>
                <button onClick={() => setConfirmando(true)} disabled={!horasValidas} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Aplicar tiempo de gracia
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
