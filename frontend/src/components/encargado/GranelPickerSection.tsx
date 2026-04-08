import { useState } from 'react';
import type { TipoGranel, GranelResponse } from '../../services/granel.service';
import type { UnidadDuracion, ItemGranel } from '../../types/solicitud.types';
import { getRentaRate, formatQ, rateSuffix } from '../../types/solicitud.types';

interface Props {
  granelData: Partial<Record<TipoGranel, GranelResponse>>;
  isLoading:  boolean;
  inCart:     (tipo: TipoGranel) => boolean;
  onAdd:      (item: Omit<ItemGranel, 'kind'>) => void;
}

interface GranelForm {
  cantidad:    string;
  fechaInicio: string;
  duracion:    string;
  unidad:      UnidadDuracion;
  conMadera:   boolean;
}

const GRANEL_TIPOS: { tipo: TipoGranel; tipoLabel: string }[] = [
  { tipo: 'PUNTAL',         tipoLabel: 'Puntales'            },
  { tipo: 'ANDAMIO_SIMPLE', tipoLabel: 'Andamios simples'    },
  { tipo: 'ANDAMIO_RUEDAS', tipoLabel: 'Andamios con ruedas' },
];

const emptyForm = (): GranelForm => ({ cantidad: '', fechaInicio: '', duracion: '', unidad: 'dias', conMadera: false });

const inputCls  = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50';
const labelCls  = 'block text-xs font-semibold text-slate-600 mb-1.5';
const selectCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50';

export default function GranelPickerSection({ granelData, isLoading, inCart, onAdd }: Props) {
  const [forms,  setForms]  = useState<Record<TipoGranel, GranelForm>>({
    PUNTAL:         emptyForm(),
    ANDAMIO_SIMPLE: emptyForm(),
    ANDAMIO_RUEDAS: emptyForm(),
  });
  const [errors, setErrors] = useState<Partial<Record<TipoGranel, string>>>({});

  const updateForm = (tipo: TipoGranel, field: keyof GranelForm, value: string) => {
    const parsed = field === 'conMadera' ? value === 'true' : value;
    setForms(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: parsed } }));
    setErrors(prev => ({ ...prev, [tipo]: undefined }));
  };

  const setError = (tipo: TipoGranel, msg: string) =>
    setErrors(prev => ({ ...prev, [tipo]: msg }));

  const handleAdd = (tipo: TipoGranel, tipoLabel: string) => {
    const form  = forms[tipo];
    const data  = granelData[tipo];
    const stock = data?.stockTotal ?? 0;

    const cant = parseInt(form.cantidad);
    const dur  = parseInt(form.duracion);

    if (!cant || cant < 1) { setError(tipo, 'La cantidad debe ser al menos 1.'); return; }
    if (cant > stock)       { setError(tipo, `Stock insuficiente (disponible: ${stock}).`); return; }
    if (!form.fechaInicio)  { setError(tipo, 'La fecha de inicio es requerida.'); return; }
    if (!dur || dur < 1)    { setError(tipo, 'La duración debe ser al menos 1.'); return; }

    const conMadera = tipo === 'ANDAMIO_SIMPLE' ? form.conMadera : undefined;
    const labelFinal = conMadera ? `${tipoLabel} (con madera)` : tipoLabel;
    onAdd({ tipo, tipoLabel: labelFinal, cantidad: cant, fechaInicio: form.fechaInicio, duracion: dur, unidad: form.unidad, config: data?.config ?? null, conMadera });
    setForms(prev => ({ ...prev, [tipo]: emptyForm() }));
    setErrors(prev => ({ ...prev, [tipo]: undefined }));
  };

  return (
    <div className="space-y-3">
      {GRANEL_TIPOS.map(({ tipo, tipoLabel }) => {
        const data       = granelData[tipo];
        const stock      = data?.stockTotal ?? 0;
        const config     = data?.config ?? null;
        const canAdd     = !isLoading && data !== undefined && stock > 0;
        const alreadyIn  = inCart(tipo);
        const form       = forms[tipo];
        const err        = errors[tipo];
        const esAndamioSimple = tipo === 'ANDAMIO_SIMPLE';
        const ratePreview = config
          ? (esAndamioSimple && form.conMadera
              ? getRentaRate(form.unidad, config.rentaDiaConMadera, config.rentaSemanaConMadera, config.rentaMesConMadera)
              : getRentaRate(form.unidad, config.rentaDia, config.rentaSemana, config.rentaMes))
          : null;

        return (
          <div key={tipo}
            className={`border border-slate-200 rounded-xl p-4 bg-slate-50 ${!canAdd ? 'opacity-60' : ''}`}>

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-800">{tipoLabel}</span>
              {isLoading ? (
                <span className="text-xs text-slate-400">Cargando...</span>
              ) : canAdd ? (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Stock: {stock.toLocaleString('es-GT')} uds.
                </span>
              ) : (
                <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                  Sin inventario registrado
                </span>
              )}
            </div>

            {alreadyIn ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="text-indigo-500 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-xs text-indigo-700">
                  Ya está en la solicitud — elimínalo del carrito para modificarlo.
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-2.5">
                  <div>
                    <label className={labelCls}>
                      Cantidad {canAdd && <span className="text-red-400">*</span>}
                    </label>
                    <input type="number" value={form.cantidad} disabled={!canAdd}
                      min="1" step="1" placeholder={canAdd ? `Máx. ${stock}` : '—'}
                      onChange={e => updateForm(tipo, 'cantidad', e.target.value)}
                      className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Fecha de inicio {canAdd && <span className="text-red-400">*</span>}
                    </label>
                    <input type="date" value={form.fechaInicio} disabled={!canAdd}
                      onChange={e => updateForm(tipo, 'fechaInicio', e.target.value)}
                      className={inputCls} />
                  </div>
                </div>

                {esAndamioSimple && (
                  <div className="flex items-center gap-3 mb-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-xs font-semibold text-slate-600 flex-1">Variante</span>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => updateForm(tipo, 'conMadera', 'false')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                          !form.conMadera
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        Sin madera
                      </button>
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => updateForm(tipo, 'conMadera', 'true')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                          form.conMadera
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        Con madera
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <div className="w-24 flex-shrink-0">
                    <label className={labelCls}>
                      Duración {canAdd && <span className="text-red-400">*</span>}
                    </label>
                    <input type="number" value={form.duracion} disabled={!canAdd}
                      min="1" step="1" placeholder="0"
                      onChange={e => updateForm(tipo, 'duracion', e.target.value)}
                      className={`${inputCls} font-mono`} />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <label className={labelCls}>Unidad</label>
                    <select value={form.unidad} disabled={!canAdd}
                      onChange={e => updateForm(tipo, 'unidad', e.target.value)}
                      className={selectCls}>
                      <option value="dias">días</option>
                      <option value="semanas">semanas</option>
                      <option value="meses">meses</option>
                    </select>
                  </div>
                  {ratePreview !== null && canAdd && (
                    <div className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-right min-w-0">
                      <div className="text-[10px] text-slate-400 leading-none mb-0.5">tarifa / ud</div>
                      <div className="text-xs font-mono font-bold text-slate-700">
                        {formatQ(ratePreview)}
                        <span className="text-slate-400 font-normal">{rateSuffix(form.unidad)}</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleAdd(tipo, tipoLabel)}
                    disabled={!canAdd}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Agregar
                  </button>
                </div>

                {err && (
                  <div className="mt-2.5 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="text-red-500 flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span className="text-xs text-red-600">{err}</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
