import type { ItemRetorno } from './types';
import { formatQ } from './types';

interface Props {
  items:              ItemRetorno[];
  esItemUnico:        boolean;
  loadingLectura:     boolean;
  costoAcumPorEquipo: Map<string, number>;
  onToggle:           (equipoId: string) => void;
  onHorometro:        (equipoId: string, val: string) => void;
}

export default function PasoEquipos({ items, esItemUnico, loadingLectura, costoAcumPorEquipo, onToggle, onHorometro }: Props) {
  const seleccionados = items.filter(it => it.seleccionado);

  return (
    <div className="space-y-3">
      {esItemUnico ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Equipo a devolver</p>
          <p className="text-sm font-semibold text-slate-800">
            <span className="font-mono text-slate-400 mr-1">#{items[0].numeracion}</span>
            {items[0].descripcion}
            {items[0].conMartillo && <span className="text-orange-600 ml-1">(+martillo)</span>}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tarifa: <span className="font-semibold text-amber-700">{formatQ(items[0].tarifaEfectiva)}/hr</span>
            {!loadingLectura && costoAcumPorEquipo.has(items[0].equipoId) && (
              <span className="ml-2">
                · Acumulado: <span className="font-semibold text-slate-700">{formatQ(costoAcumPorEquipo.get(items[0].equipoId)!)}</span>
              </span>
            )}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 leading-relaxed">
            Selecciona los equipos que el cliente está devolviendo.
          </p>
          <div className="space-y-2">
            {items.map(it => (
              <label
                key={it.equipoId}
                className={`flex items-start gap-3 border rounded-xl p-3.5 cursor-pointer transition-colors ${
                  it.seleccionado ? 'border-slate-700 bg-slate-800/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.seleccionado}
                  onChange={() => onToggle(it.equipoId)}
                  className="mt-0.5 accent-slate-800 w-4 h-4 cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-tight">
                    <span className="font-mono text-slate-400 mr-1">#{it.numeracion}</span>
                    {it.descripcion}
                    {it.conMartillo && <span className="text-orange-600 ml-1">(+martillo)</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tarifa: <span className="font-semibold text-amber-700">{formatQ(it.tarifaEfectiva)}/hr</span>
                    {!loadingLectura && costoAcumPorEquipo.has(it.equipoId) && (
                      <span className="ml-2">
                        · Acumulado: <span className="font-semibold text-slate-700">{formatQ(costoAcumPorEquipo.get(it.equipoId)!)}</span>
                      </span>
                    )}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {seleccionados.map(it => (
        <div key={it.equipoId} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Horómetro final — #{it.numeracion}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={it.horometroDevolucion}
            onChange={e => onHorometro(it.equipoId, e.target.value)}
            placeholder="Ej: 1345.2"
            className="w-40 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 bg-white"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Lectura del horómetro al momento de entregar el equipo. Si es mayor al último fin 5PM, la diferencia se cobra como horas nocturnas.
          </p>
        </div>
      ))}
    </div>
  );
}
