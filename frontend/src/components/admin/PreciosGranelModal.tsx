import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { granelService } from '../../services/granel.service';
import type { ConfigGranel, TipoGranel } from '../../services/granel.service';

interface Props {
  tipo:      TipoGranel;
  tipoLabel: string;
  config:    ConfigGranel | null;
  open:      boolean;
  onClose:   () => void;
  onSave:    (updated: ConfigGranel) => void;
}

interface FormState {
  rentaDia:             string;
  rentaSemana:          string;
  rentaMes:             string;
  rentaDiaConMadera:    string;
  rentaSemanaConMadera: string;
  rentaMesConMadera:    string;
}

export default function PreciosGranelModal({ tipo, tipoLabel, config, open, onClose, onSave }: Props) {
  const [form,     setForm]     = useState<FormState>({
    rentaDia: '', rentaSemana: '', rentaMes: '',
    rentaDiaConMadera: '', rentaSemanaConMadera: '', rentaMesConMadera: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const esAndamioSimple = tipo === 'ANDAMIO_SIMPLE';

  useEffect(() => {
    if (config) {
      setForm({
        rentaDia:             config.rentaDia    != null ? config.rentaDia.toString()    : '',
        rentaSemana:          config.rentaSemana != null ? config.rentaSemana.toString() : '',
        rentaMes:             config.rentaMes    != null ? config.rentaMes.toString()    : '',
        rentaDiaConMadera:    config.rentaDiaConMadera    != null ? config.rentaDiaConMadera.toString()    : '',
        rentaSemanaConMadera: config.rentaSemanaConMadera != null ? config.rentaSemanaConMadera.toString() : '',
        rentaMesConMadera:    config.rentaMesConMadera    != null ? config.rentaMesConMadera.toString()    : '',
      });
      setApiError(null);
    }
  }, [config]);

  if (!open) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleSave = async () => {
    const dia    = parseFloat(form.rentaDia);
    const semana = parseFloat(form.rentaSemana);
    const mes    = parseFloat(form.rentaMes);

    if (isNaN(dia)    || dia    < 0) { setApiError('El precio por día no es válido.');    return; }
    if (isNaN(semana) || semana < 0) { setApiError('El precio por semana no es válido.'); return; }
    if (isNaN(mes)    || mes    < 0) { setApiError('El precio por mes no es válido.');    return; }

    let maderaPayload: { rentaDiaConMadera?: number; rentaSemanaConMadera?: number; rentaMesConMadera?: number } = {};
    if (esAndamioSimple) {
      const diaMad    = parseFloat(form.rentaDiaConMadera);
      const semanaMad = parseFloat(form.rentaSemanaConMadera);
      const mesMad    = parseFloat(form.rentaMesConMadera);
      if (isNaN(diaMad)    || diaMad    < 0) { setApiError('El precio con madera por día no es válido.');    return; }
      if (isNaN(semanaMad) || semanaMad < 0) { setApiError('El precio con madera por semana no es válido.'); return; }
      if (isNaN(mesMad)    || mesMad    < 0) { setApiError('El precio con madera por mes no es válido.');    return; }
      maderaPayload = { rentaDiaConMadera: diaMad, rentaSemanaConMadera: semanaMad, rentaMesConMadera: mesMad };
    }

    setIsSaving(true);
    setApiError(null);

    try {
      const updated = await granelService.updateConfig({ tipo, rentaDia: dia, rentaSemana: semana, rentaMes: mes, ...maderaPayload });
      onSave(updated);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setApiError(msg ?? 'Ocurrió un error al guardar los precios.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[360px] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Precios de renta — {tipoLabel}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Aplica a todas las unidades del inventario</p>
          </div>
          <button onClick={onClose} disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-[11px] text-slate-400">
            Cambiar estos valores afectará el cálculo de rentas futuras de {tipoLabel.toLowerCase()}.
          </p>

          {([
            { field: 'rentaDia'    as const, label: 'Precio por día',    placeholder: '0.00' },
            { field: 'rentaSemana' as const, label: 'Precio por semana', placeholder: '0.00' },
            { field: 'rentaMes'    as const, label: 'Precio por mes',    placeholder: '0.00' },
          ]).map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className={labelCls}>{label} <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono select-none">Q</span>
                <input
                  type="number"
                  value={form[field]}
                  onChange={handleChange(field)}
                  disabled={isSaving}
                  min="0"
                  step="any"
                  placeholder={placeholder}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          ))}

          {esAndamioSimple && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Variante con madera
                </p>
                {([
                  { field: 'rentaDiaConMadera'    as const, label: 'Precio por día (con madera)',    placeholder: '0.00' },
                  { field: 'rentaSemanaConMadera' as const, label: 'Precio por semana (con madera)', placeholder: '0.00' },
                  { field: 'rentaMesConMadera'    as const, label: 'Precio por mes (con madera)',    placeholder: '0.00' },
                ]).map(({ field, label, placeholder }) => (
                  <div key={field} className="mb-4 last:mb-0">
                    <label className={labelCls}>{label} <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono select-none">Q</span>
                      <input
                        type="number"
                        value={form[field]}
                        onChange={handleChange(field)}
                        disabled={isSaving}
                        min="0"
                        step="any"
                        placeholder={placeholder}
                        className={`${inputCls} pl-7`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {apiError && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-red-600 font-medium">{apiError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Guardar precios</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
