import { useState } from 'react';
import { solicitudesService } from '../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot, DevolucionEntry } from '../../types/solicitud-renta.types';
import { formatQ } from '../../types/solicitud.types';

interface Props {
  solicitud:  SolicitudRenta;
  onClose:    () => void;
  onDevolucion: (actualizada: SolicitudRenta) => void;
}

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

interface ItemRetorno {
  equipoId:            string;
  numeracion:          string;
  descripcion:         string;
  horometroDevolucion: string;
  seleccionado:        boolean;
}

interface CargoExtra {
  descripcion: string;
  monto:       string;
}

function getPendientes(solicitud: SolicitudRenta): PesadaItem[] {
  const devoluciones = (solicitud.devolucionesParciales ?? []) as DevolucionEntry[];
  const yaDevueltos  = new Set(devoluciones.flatMap(d => d.items.map(i => i.itemRef)));
  return (solicitud.items as ItemSnapshot[])
    .filter((i): i is PesadaItem => i.kind === 'pesada' && !yaDevueltos.has(i.equipoId));
}

export default function DevolucionPesadaModal({ solicitud, onClose, onDevolucion }: Props) {
  const pendientes = getPendientes(solicitud);

  const [items, setItems] = useState<ItemRetorno[]>(
    pendientes.map(p => ({
      equipoId:            p.equipoId,
      numeracion:          p.numeracion,
      descripcion:         p.descripcion,
      horometroDevolucion: '',
      seleccionado:        true,
    })),
  );
  const [cargosExtras, setCargosExtras] = useState<CargoExtra[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, seleccionado: !it.seleccionado } : it));
  };

  const setHorometro = (idx: number, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, horometroDevolucion: value } : it));
  };

  const addCargo = () => setCargosExtras(prev => [...prev, { descripcion: '', monto: '' }]);
  const removeCargo = (idx: number) => setCargosExtras(prev => prev.filter((_, i) => i !== idx));
  const setCargo = (idx: number, field: keyof CargoExtra, value: string) => {
    setCargosExtras(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleSubmit = async () => {
    const seleccionados = items.filter(it => it.seleccionado);
    if (seleccionados.length === 0) {
      setError('Selecciona al menos un equipo para devolver.');
      return;
    }

    const cargosValidos = cargosExtras.filter(c => c.descripcion.trim() && c.monto.trim());
    const cargosInvalidos = cargosExtras.some(
      c => (c.descripcion.trim() && !c.monto.trim()) || (!c.descripcion.trim() && c.monto.trim()),
    );
    if (cargosInvalidos) {
      setError('Completa descripción y monto en todos los cargos adicionales.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const actualizada = await solicitudesService.registrarDevolucionPesada(solicitud.id, {
        items: seleccionados.map(it => ({
          equipoId:            it.equipoId,
          horometroDevolucion: it.horometroDevolucion ? parseFloat(it.horometroDevolucion) : 0,
        })),
        recargosAdicionales: cargosValidos.map(c => ({
          descripcion: c.descripcion.trim(),
          monto:       parseFloat(c.monto),
        })),
      });
      onDevolucion(actualizada);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la devolución.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-500 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Registrar Devolución — Pesada</p>
              <p className="text-xs text-slate-500">{solicitud.cliente.nombre} · {solicitud.folio ?? solicitud.id.slice(0,8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Items pendientes */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Equipos a devolver</p>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.equipoId}
                  className={`rounded-xl border p-3 transition-colors ${
                    it.seleccionado ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={it.seleccionado}
                      onChange={() => toggleItem(idx)}
                      className="mt-0.5 accent-amber-500 w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{it.numeracion}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate">{it.descripcion}</span>
                      </div>
                      {it.seleccionado && (
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 block mb-1">
                            Horómetro de devolución (opcional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={it.horometroDevolucion}
                            onChange={e => setHorometro(idx, e.target.value)}
                            placeholder="Ej: 1345.2"
                            className="w-40 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Sirve para calcular horas nocturnas del último día.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cargos adicionales */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-600">Cargos adicionales</p>
              <button
                onClick={addCargo}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Agregar cargo
              </button>
            </div>
            {cargosExtras.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Sin cargos adicionales</p>
            ) : (
              <div className="space-y-2">
                {cargosExtras.map((cargo, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input
                      type="text"
                      placeholder="Descripción (daños, etc.)"
                      value={cargo.descripcion}
                      onChange={e => setCargo(idx, 'descripcion', e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">Q</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={cargo.monto}
                        onChange={e => setCargo(idx, 'monto', e.target.value)}
                        className="w-24 pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                      />
                    </div>
                    <button
                      onClick={() => removeCargo(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
            El costo total se calcula sumando todos los días de horómetro registrados. Si hay horas nocturnas en el último día (horómetro de devolución mayor al último fin 5PM), se incluyen en el cálculo.
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">{error}</div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Procesando...
              </>
            ) : (
              'Confirmar Devolución'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
