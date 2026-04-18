import { useMemo, useState } from 'react';
import type { SolicitudRenta, ItemSnapshot, ExtensionEntry, UnidadDuracion } from '../../types/solicitud-renta.types';
import { solicitudesService, type ExtensionItemPayload } from '../../services/solicitudes.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularFin(inicio: Date, duracion: number, unidad: UnidadDuracion): Date {
  if (unidad === 'horas')   return new Date(inicio.getTime() + duracion * 3_600_000);
  if (unidad === 'dias')    return new Date(inicio.getTime() + duracion * 86_400_000);
  if (unidad === 'semanas') return new Date(inicio.getTime() + duracion * 7 * 86_400_000);
  return new Date(inicio.getTime() + duracion * 30 * 86_400_000);
}

function calcularFinConExtensiones(
  inicio:      Date,
  item:        ItemSnapshot,
  extensiones: ExtensionEntry[],
): Date {
  const ref  = item.kind === 'maquinaria' ? item.equipoId : item.tipo;
  const exts = extensiones.filter(e => e.itemRef === ref);
  let fin = calcularFin(inicio, item.duracion, item.unidad);
  for (const ext of exts) {
    fin = calcularFin(fin, ext.duracion, ext.unidad);
  }
  return fin;
}

function itemRef(item: ItemSnapshot): string {
  return item.kind === 'maquinaria' ? item.equipoId : item.tipo;
}

function itemLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria') return `#${item.numeracion} ${item.descripcion}`;
  return `${item.tipoLabel}${item.conMadera ? ' (c/madera)' : ''} × ${item.cantidad.toLocaleString('es-GT')}`;
}

function formatFechaCorta(d: Date): string {
  return d.toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemGracia {
  checked: boolean;
  horas:   number | '';
}

// ── Componente principal ──────────────────────────────────────────────────────

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

  // Separar ítems vencidos de los que aún no vencieron
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

  const esUnico = vencidos.length === 1;

  const [estado, setEstado] = useState<Record<string, ItemGracia>>(
    () => Object.fromEntries(
      vencidos.map(item => [
        itemRef(item),
        { checked: esUnico, horas: '' },
      ]),
    ),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const algunoSeleccionado = Object.values(estado).some(e => e.checked);
  const todosConHoras      = Object.values(estado).every(e => !e.checked || (e.horas !== '' && e.horas >= 1));

  const handleToggle = (ref: string) =>
    setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], checked: !prev[ref].checked } }));

  const handleHoras = (ref: string, raw: string) => {
    if (raw === '') {
      setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], horas: '' } }));
      return;
    }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) {
      setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], horas: n } }));
    }
  };

  const handleConfirmar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const items: ExtensionItemPayload[] = vencidos
        .filter(item => estado[itemRef(item)]?.checked)
        .map(item => ({
          itemRef:  itemRef(item),
          kind:     item.kind,
          duracion: estado[itemRef(item)].horas as number,
          unidad:   'horas' as const,
        }));

      const actualizada = await solicitudesService.ampliar(solicitud.id, items);
      onGracia(actualizada);
    } catch {
      setError('No se pudo aplicar el tiempo de gracia. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const HorasInput = ({ ref: _ref, horas, onHoras, indent = false }: {
    ref?:    string;
    horas:   number | '';
    onHoras: (val: string) => void;
    indent?: boolean;
  }) => (
    <div className={`${indent ? 'mt-3 ml-7' : ''}`}>
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
        Horas adicionales
      </label>
      <input
        type="number"
        min={1}
        value={horas}
        onChange={e => onHoras(e.target.value)}
        placeholder="Ej. 4"
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Tiempo de gracia</h2>
            <p className="text-xs text-slate-500 mt-0.5">Folio {solicitud.folio}</p>
          </div>
          <button
            onClick={() => confirmando ? setConfirmando(false) : onClose()}
            disabled={guardando}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {confirmando ? (
            /* ── Pantalla de confirmación ── */
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Esta acción <span className="font-semibold">no se puede revertir</span>. El tiempo de gracia quedará registrado sin costo adicional.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Tiempo a aplicar</p>
                <ul className="space-y-2">
                  {vencidos
                    .filter(item => estado[itemRef(item)]?.checked)
                    .map(item => {
                      const ext = estado[itemRef(item)];
                      return (
                        <li key={itemRef(item)} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="text-sm text-slate-800 truncate mr-3">{itemLabel(item)}</span>
                          <span className="text-sm font-semibold text-amber-700 shrink-0">
                            +{ext.horas}h de gracia
                          </span>
                        </li>
                      );
                    })
                  }
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Extiende el tiempo sin cargo adicional para los equipos que aún no han sido devueltos.
              </p>

              {/* Ítems vencidos */}
              {esUnico ? (
                /* Modo un solo ítem vencido */
                (() => {
                  const item = vencidos[0];
                  const ref  = itemRef(item);
                  const fin  = calcularFinConExtensiones(inicio, item, extensiones);
                  return (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{itemLabel(item)}</p>
                        <p className="text-[11px] text-red-500 mt-0.5">
                          Venció {formatFechaCorta(fin)}
                        </p>
                      </div>
                      <HorasInput
                        horas={estado[ref].horas}
                        onHoras={val => handleHoras(ref, val)}
                      />
                    </div>
                  );
                })()
              ) : (
                /* Modo múltiples ítems vencidos */
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">
                    Vencidos ({vencidos.length})
                  </p>
                  {vencidos.map(item => {
                    const ref = itemRef(item);
                    const ext = estado[ref];
                    const fin = calcularFinConExtensiones(inicio, item, extensiones);
                    return (
                      <div
                        key={ref}
                        className={`border rounded-xl p-4 transition-colors ${
                          ext.checked ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ext.checked}
                            onChange={() => handleToggle(ref)}
                            className="mt-0.5 accent-amber-600 w-4 h-4 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-tight">{itemLabel(item)}</p>
                            <p className="text-[11px] text-red-500 mt-0.5">
                              Venció {formatFechaCorta(fin)}
                            </p>
                          </div>
                        </label>
                        {ext.checked && (
                          <HorasInput
                            horas={ext.horas}
                            onHoras={val => handleHoras(ref, val)}
                            indent
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ítems aún activos (sólo informativo) */}
              {activos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Aún activos ({activos.length})
                  </p>
                  {activos.map(item => {
                    const fin = calcularFinConExtensiones(inicio, item, extensiones);
                    return (
                      <div key={itemRef(item)} className="border border-slate-200 rounded-xl px-4 py-3 opacity-60">
                        <p className="text-sm font-medium text-slate-700 leading-tight">{itemLabel(item)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Vence {formatFechaCorta(fin)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {confirmando ? (
              <>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={guardando}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardando && (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  )}
                  Sí, aplicar gracia
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setConfirmando(true)}
                  disabled={!algunoSeleccionado || !todosConHoras}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
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
