// PreciosEquipoModal.tsx — editar tarifas de renta de un equipo (solo admin)

import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo } from '../../types/equipo.types';
import { equiposService } from '../../services/equipos.service';

interface PreciosEquipoModalProps {
  equipo:  Equipo | null;
  open:    boolean;
  onClose: () => void;
  onSave:  (updated: Equipo) => void;
}

interface FormState {
  rentaHora:   string;
  rentaDia:    string;
  rentaSemana: string;
  rentaMes:    string;
}

export default function PreciosEquipoModal({ equipo, open, onClose, onSave }: PreciosEquipoModalProps) {
  const [form, setForm]         = useState<FormState>({ rentaHora: '', rentaDia: '', rentaSemana: '', rentaMes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const esPesada = equipo?.tipo.nombre === 'PESADA';

  useEffect(() => {
    if (equipo) {
      setForm({
        rentaHora:   equipo.rentaHora   != null ? equipo.rentaHora.toString()   : '',
        rentaDia:    equipo.rentaDia    != null ? equipo.rentaDia.toString()    : '',
        rentaSemana: equipo.rentaSemana != null ? equipo.rentaSemana.toString() : '',
        rentaMes:    equipo.rentaMes    != null ? equipo.rentaMes.toString()    : '',
      });
      setApiError(null);
    }
  }, [equipo]);

  if (!open || !equipo) return null;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setApiError(null);
    };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const handleSave = async () => {
    const hora   = form.rentaHora   ? parseFloat(form.rentaHora)   : undefined;
    const dia    = form.rentaDia    ? parseFloat(form.rentaDia)    : undefined;
    const semana = form.rentaSemana ? parseFloat(form.rentaSemana) : undefined;
    const mes    = form.rentaMes    ? parseFloat(form.rentaMes)    : undefined;

    if (hora   != null && (isNaN(hora)   || hora   < 0)) { setApiError('El precio por hora no es válido.'); return; }
    if (dia    != null && (isNaN(dia)    || dia    < 0)) { setApiError('El precio por día no es válido.'); return; }
    if (semana != null && (isNaN(semana) || semana < 0)) { setApiError('El precio por semana no es válido.'); return; }
    if (mes    != null && (isNaN(mes)    || mes    < 0)) { setApiError('El precio por mes no es válido.'); return; }

    setIsSaving(true);
    setApiError(null);

    try {
      const updated = await equiposService.update(equipo.id, {
        rentaHora:   hora,
        rentaDia:    dia,
        rentaSemana: semana,
        rentaMes:    mes,
      });
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
            <h2 className="font-bold text-slate-800 text-base">Precios de renta</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              #{equipo.numeracion} · {equipo.descripcion.length > 32 ? equipo.descripcion.substring(0, 32) + '…' : equipo.descripcion}
            </p>
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
          <p className="text-[11px] text-slate-400">Deja vacío el campo si la tarifa no aplica para este equipo.</p>

          {esPesada ? (
            // Maquinaria pesada: solo tarifa por hora
            <div>
              <label className={labelCls}>Precio por hora</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono select-none">Q</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.rentaHora}
                  onChange={handleChange('rentaHora')}
                  disabled={isSaving}
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          ) : (
            // Maquinaria liviana: día / semana / mes
            <>
              {([
                { field: 'rentaDia'    as const, label: 'Precio por día'    },
                { field: 'rentaSemana' as const, label: 'Precio por semana' },
                { field: 'rentaMes'    as const, label: 'Precio por mes'    },
              ]).map(({ field, label }) => (
                <div key={field}>
                  <label className={labelCls}>{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono select-none">Q</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[field]}
                      onChange={handleChange(field)}
                      disabled={isSaving}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
              ))}
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
