import { useState } from 'react';
import type { SolicitudRenta, ItemSnapshot, UnidadDuracion } from '../../types/solicitud-renta.types';
import { solicitudesService, type ExtensionItemPayload } from '../../services/solicitudes.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria' || item.kind === 'pesada') return `#${item.numeracion} ${item.descripcion}`;
  return `${item.tipoLabel}${item.conMadera ? ' (c/madera)' : ''} × ${item.cantidad.toLocaleString('es-GT')}`;
}

function itemKindLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria') return 'Maquinaria';
  if (item.kind === 'pesada')     return 'Maquinaria pesada';
  return 'A granel';
}

function itemRef(item: ItemSnapshot): string {
  return item.kind === 'maquinaria' || item.kind === 'pesada' ? item.equipoId : item.tipo;
}

const UNIDAD_OPTS: { value: UnidadDuracion; label: string }[] = [
  { value: 'dias',    label: 'Días'    },
  { value: 'semanas', label: 'Semanas' },
  { value: 'meses',   label: 'Meses'   },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemExtension {
  checked:  boolean;
  duracion: number | '';
  unidad:   UnidadDuracion;
}

// ── Inputs de duración ────────────────────────────────────────────────────────

function DuracionInputs({
  ext,
  onDuracion,
  onUnidad,
  indent = false,
}: {
  ext:        ItemExtension;
  onDuracion: (val: string) => void;
  onUnidad:   (val: UnidadDuracion) => void;
  indent?:    boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${indent ? 'mt-3 ml-7' : ''}`}>
      <div className="flex-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
          Duración adicional
        </label>
        <input
          type="number"
          min={1}
          value={ext.duracion}
          onChange={e => onDuracion(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <div className="flex-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
          Unidad
        </label>
        <select
          value={ext.unidad}
          onChange={e => onUnidad(e.target.value as UnidadDuracion)}
          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          {UNIDAD_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AmpliacionRentaModal({
  solicitud,
  onClose,
  onAmpliar,
}: {
  solicitud: SolicitudRenta;
  onClose:   () => void;
  onAmpliar: (actualizada: SolicitudRenta) => void;
}) {
  const esUnico = solicitud.items.length === 1;

  const [estado, setEstado] = useState<Record<string, ItemExtension>>(
    () => Object.fromEntries(
      solicitud.items.map(item => [
        itemRef(item),
        { checked: esUnico, duracion: '', unidad: 'dias' },
      ]),
    ),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const algunoSeleccionado = Object.values(estado).some(e => e.checked);
  const todosConDuracion   = Object.values(estado).every(e => !e.checked || (e.duracion !== '' && e.duracion >= 1));

  const handleToggle   = (ref: string) =>
    setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], checked: !prev[ref].checked } }));

  const handleDuracion = (ref: string, raw: string) => {
    if (raw === '') { setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], duracion: '' } })); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], duracion: n } }));
  };

  const handleUnidad = (ref: string, unidad: UnidadDuracion) =>
    setEstado(prev => ({ ...prev, [ref]: { ...prev[ref], unidad } }));

  const handleConfirmar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const items: ExtensionItemPayload[] = solicitud.items
        .filter(item => estado[itemRef(item)]?.checked)
        .map(item => ({
          itemRef:  itemRef(item),
          kind:     item.kind,
          duracion: estado[itemRef(item)].duracion as number,
          unidad:   estado[itemRef(item)].unidad,
        }));
      const actualizada = await solicitudesService.ampliar(solicitud.id, items);
      onAmpliar(actualizada);
    } catch {
      setError('No se pudo ampliar la renta. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Ampliar renta</h2>
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
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Esta acción <span className="font-semibold">no se puede revertir</span>. La extensión quedará registrada
                  {solicitud.esPesada ? ' y la fecha de finalización estimada se actualizará.' : ' y el costo adicional se sumará al total de la renta.'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Resumen de la extensión</p>
                <ul className="space-y-2">
                  {solicitud.items
                    .filter(item => estado[itemRef(item)]?.checked)
                    .map(item => {
                      const ext        = estado[itemRef(item)];
                      const unidadLabel = UNIDAD_OPTS.find(o => o.value === ext.unidad)?.label ?? ext.unidad;
                      return (
                        <li key={itemRef(item)} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="text-sm text-slate-800 truncate mr-3">{itemLabel(item)}</span>
                          <span className="text-sm font-semibold text-indigo-700 shrink-0">
                            +{ext.duracion} {unidadLabel.toLowerCase()}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          ) : esUnico ? (
            (() => {
              const item = solicitud.items[0];
              const ref  = itemRef(item);
              const ext  = estado[ref];
              return (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{itemLabel(item)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{itemKindLabel(item)} • Inicio: {item.fechaInicio}</p>
                  </div>
                  <DuracionInputs ext={ext} onDuracion={val => handleDuracion(ref, val)} onUnidad={val => handleUnidad(ref, val)} />
                  {item.kind !== 'pesada' && (
                    <p className="text-[11px] text-slate-400">El costo se calculará con los precios actuales al confirmar.</p>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecciona los equipos a extender e indica la duración adicional.
                {!solicitud.esPesada && ' El costo se calculará con los precios actuales al confirmar.'}
              </p>
              {solicitud.items.map(item => {
                const ref = itemRef(item);
                const ext = estado[ref];
                return (
                  <div key={ref} className={`border rounded-xl p-4 transition-colors ${ext.checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={ext.checked} onChange={() => handleToggle(ref)} className="mt-0.5 accent-indigo-600 w-4 h-4 cursor-pointer" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{itemLabel(item)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{itemKindLabel(item)} • Inicio: {item.fechaInicio}</p>
                      </div>
                    </label>
                    {ext.checked && (
                      <DuracionInputs ext={ext} onDuracion={val => handleDuracion(ref, val)} onUnidad={val => handleUnidad(ref, val)} indent />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {confirmando ? (
              <>
                <button onClick={() => setConfirmando(false)} disabled={guardando} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors disabled:opacity-60">
                  Volver
                </button>
                <button onClick={handleConfirmar} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {guardando && <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                  Sí, ampliar renta
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => setConfirmando(true)}
                  disabled={!algunoSeleccionado || !todosConDuracion}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                  Confirmar extensión
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
