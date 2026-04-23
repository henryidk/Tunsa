import { useState, useEffect, useCallback } from 'react';
import { solicitudesService, type LecturaHorometro } from '../../services/solicitudes.service';
import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import { formatQ } from '../../types/solicitud.types';

interface Props {
  solicitud: SolicitudRenta;
  onClose:   () => void;
}

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

function formatFecha(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function HorometroPanel({ solicitud, onClose }: Props) {
  const pesadaItems = (solicitud.items as ItemSnapshot[]).filter(
    (i): i is PesadaItem => i.kind === 'pesada',
  );

  const [activeEquipo,   setActiveEquipo]   = useState<string>(pesadaItems[0]?.equipoId ?? '');
  const [lecturas,       setLecturas]       = useState<LecturaHorometro[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  // Formulario de nueva lectura
  const [fecha,    setFecha]    = useState(today());
  const [tipo,     setTipo]     = useState<'inicio' | 'fin5pm'>('inicio');
  const [valor,    setValor]    = useState('');

  const fetchLecturas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await solicitudesService.getLecturas(solicitud.id);
      setLecturas(data);
    } catch {
      setError('No se pudieron cargar las lecturas.');
    } finally {
      setIsLoading(false);
    }
  }, [solicitud.id]);

  useEffect(() => { void fetchLecturas(); }, [fetchLecturas]);

  const lecturasEquipo = lecturas.filter(l => l.equipoId === activeEquipo);
  const costoAcumulado = lecturasEquipo.reduce((s, l) => s + (l.costoTotal ?? 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 0) {
      setSubmitError('El valor del horómetro debe ser un número válido mayor o igual a 0.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await solicitudesService.registrarLectura(solicitud.id, {
        equipoId: activeEquipo,
        fecha,
        tipo,
        valor:    valorNum,
      });
      setValor('');
      await fetchLecturas();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setSubmitError(
        Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo registrar la lectura.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeItem = pesadaItems.find(i => i.equipoId === activeEquipo);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Horómetro — {solicitud.folio ?? solicitud.id.slice(0, 8)}</p>
              <p className="text-xs text-slate-500">{solicitud.cliente.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: equipo tabs (if multiple) */}
          {pesadaItems.length > 1 && (
            <div className="w-44 border-r border-slate-200 p-3 space-y-1 flex-shrink-0 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-2 mb-2">Equipos</p>
              {pesadaItems.map(item => (
                <button
                  key={item.equipoId}
                  onClick={() => setActiveEquipo(item.equipoId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeEquipo === item.equipoId
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-400">#{item.numeracion}</span>
                  <br />
                  <span className="truncate block">{item.descripcion.split(' ').slice(0, 3).join(' ')}</span>
                </button>
              ))}
            </div>
          )}

          {/* Right: content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Active equipo info */}
            {activeItem && (
              <div className="px-6 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mr-2">
                    #{activeItem.numeracion}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{activeItem.descripcion}</span>
                  {activeItem.conMartillo && (
                    <span className="ml-2 text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">+Martillo</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Tarifa</p>
                  <p className="text-sm font-bold text-slate-700">{formatQ(activeItem.tarifaEfectiva)}/hr</p>
                </div>
              </div>
            )}

            {/* Readings table */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {error ? (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl p-4 border border-red-200">{error}</div>
              ) : isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
                </div>
              ) : lecturasEquipo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p className="text-sm">Sin lecturas registradas</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['Fecha', 'Inicio', 'Fin 5PM', 'H. Diurnas', 'H. Noct.', 'Ajuste', 'Total día'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lecturasEquipo.map(l => (
                          <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{formatFecha(l.fecha)}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{l.horometroInicio ?? <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{l.horometroFin5pm ?? <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">
                              {l.horasDiurnasFacturadas != null ? l.horasDiurnasFacturadas.toFixed(1) : '—'}
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

                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Costo acumulado este equipo</p>
                      <p className="text-lg font-bold text-slate-800">{formatQ(costoAcumulado)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Register reading form */}
            <div className="border-t border-slate-200 px-6 py-4 flex-shrink-0 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 mb-3">Registrar lectura</p>
              <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    max={today()}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Tipo</label>
                  <select
                    value={tipo}
                    onChange={e => setTipo(e.target.value as 'inicio' | 'fin5pm')}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="inicio">Inicio del día</option>
                    <option value="fin5pm">Fin 5 PM</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Valor horómetro</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    placeholder="Ej: 1234.5"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                    required
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
                  Registrar
                </button>
              </form>
              {submitError && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{submitError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
