import { type DescuentoFormState, calcularDescuento } from '../../types/descuento.types';

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

interface Props {
  montoBase:     number;
  loadingMonto:  boolean;
  estado:        DescuentoFormState;
  onChange:      (s: DescuentoFormState) => void;
}

export default function PasoDescuento({ montoBase, loadingMonto, estado, onChange }: Props) {
  const resultado  = calcularDescuento(estado, montoBase);
  const valorNum   = parseFloat(estado.valor);
  const inputError = estado.aplicar && estado.valor !== '' && resultado === null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Como cliente especial, puedes aplicar un descuento sobre el total calculado antes de registrar la devolución.
      </p>

      {/* Total base */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-xs font-semibold text-slate-500">Total calculado</span>
        {loadingMonto ? (
          <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
        ) : (
          <span className="text-base font-bold font-mono text-slate-800">{formatQ(montoBase)}</span>
        )}
      </div>

      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => onChange({ ...estado, aplicar: !estado.aplicar, valor: '' })}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            estado.aplicar ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            estado.aplicar ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </div>
        <span className="text-sm font-medium text-slate-700">
          {estado.aplicar ? 'Aplicar descuento' : 'Sin descuento'}
        </span>
      </label>

      {estado.aplicar && (
        <div className="space-y-4">
          {/* Tipo de descuento */}
          <div className="flex gap-3">
            {(['porcentaje', 'monto_fijo'] as const).map(tipo => (
              <label
                key={tipo}
                className={`flex items-center gap-2 flex-1 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                  estado.tipo === tipo
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="tipo-descuento"
                  checked={estado.tipo === tipo}
                  onChange={() => onChange({ ...estado, tipo, valor: '' })}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {tipo === 'porcentaje' ? 'Ej: 20%' : 'Ej: Q 18,000'}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {/* Input */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              {estado.tipo === 'porcentaje' ? 'Porcentaje de descuento (%)' : 'Monto final a cobrar (Q)'}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={estado.valor}
              onChange={e => onChange({ ...estado, valor: e.target.value })}
              placeholder={estado.tipo === 'porcentaje' ? 'Ej: 20' : 'Ej: 18000'}
              className={`w-48 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                inputError
                  ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                  : 'border-slate-300 focus:ring-indigo-100 focus:border-indigo-400'
              }`}
            />
            {inputError && (
              <p className="text-[11px] text-red-600 mt-1">
                {estado.tipo === 'monto_fijo'
                  ? `El monto debe ser menor al total (${formatQ(montoBase)}).`
                  : 'El porcentaje debe ser entre 0 y 100.'}
              </p>
            )}
          </div>

          {/* Preview */}
          {resultado && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Total original</span>
                <span className="font-mono text-slate-600 line-through">{formatQ(resultado.montoOriginal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-600 font-medium">
                  Descuento{' '}
                  {resultado.tipo === 'porcentaje'
                    ? `(${resultado.valor}%)`
                    : `(monto fijo)`}
                </span>
                <span className="font-mono font-semibold text-red-600">
                  − {formatQ(resultado.montoOriginal - resultado.montoFinal)}
                </span>
              </div>
              <div className="border-t border-indigo-200 pt-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-800">Total a cobrar</span>
                <span className="text-base font-bold font-mono text-indigo-700">{formatQ(resultado.montoFinal)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
