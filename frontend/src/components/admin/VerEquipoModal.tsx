// VerEquipoModal.tsx — visualización completa de un equipo (solo lectura)
// No contiene formulario, estado de edición ni llamadas al backend.
// Todos los datos vienen del objeto Equipo ya cargado en memoria.

import type { MouseEvent } from 'react';
import type { Equipo } from '../../types/equipo.types';
import { TIPO_BADGE } from '../../types/equipo.types';

interface VerEquipoModalProps {
  equipo:  Equipo | null;
  open:    boolean;
  onClose: () => void;
}

function formatMoneda(value: number | null | undefined): string {
  if (value == null) return '—';
  return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-slate-800 font-medium">{value}</dd>
    </div>
  );
}

export default function VerEquipoModal({ equipo, open, onClose }: VerEquipoModalProps) {
  if (!open || !equipo) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const estadoBadge = equipo.isActive
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Activo</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Dado de baja</span>;

  const tipoBadge = (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${TIPO_BADGE[equipo.tipo.nombre] ?? 'bg-slate-100 text-slate-600'}`}>
      {equipo.tipo.nombre.replace(/_/g, ' ')}
    </span>
  );

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[520px] shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <span className="font-mono font-bold text-slate-500 text-sm bg-slate-100 px-2.5 py-1 rounded-lg">
                #{equipo.numeracion}
              </span>
              {estadoBadge}
            </div>
            <h2 className="font-bold text-slate-800 text-base mt-2 leading-snug pr-6">
              {equipo.descripcion}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">

          {/* Clasificación */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Clasificación</h3>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Tipo" value={tipoBadge} />
              <Field
                label="Categoría"
                value={equipo.categoria
                  ? <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{equipo.categoria.nombre}</span>
                  : <span className="text-slate-300 text-sm">Sin categoría</span>
                }
              />
            </dl>
          </section>

          <div className="border-t border-slate-100" />

          {/* Identificación */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificación</h3>
            <dl className="grid grid-cols-2 gap-4">
              <Field
                label="Serie"
                value={equipo.serie
                  ? <span className="font-mono text-slate-700">{equipo.serie}</span>
                  : <span className="text-slate-300">—</span>
                }
              />
              <Field label="Fecha de compra" value={formatFecha(equipo.fechaCompra)} />
              <Field
                label="Monto de compra"
                value={<span className="font-mono">{formatMoneda(equipo.montoCompra)}</span>}
              />
              <Field label="Registrado" value={formatFecha(equipo.createdAt)} />
            </dl>
          </section>

          <div className="border-t border-slate-100" />

          {/* Tarifas */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tarifas de renta</h3>
            <dl className="grid grid-cols-3 gap-4">
              {[
                { label: 'Por día',    value: equipo.rentaDia },
                { label: 'Por semana', value: equipo.rentaSemana },
                { label: 'Por mes',    value: equipo.rentaMes },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
                  <div className="text-base font-bold text-indigo-600 font-mono">
                    {value != null
                      ? `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className="text-slate-300 font-normal text-sm">No aplica</span>
                    }
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {/* Baja — solo si aplica */}
          {!equipo.isActive && (
            <>
              <div className="border-t border-slate-100" />
              <section>
                <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-3">Información de baja</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <Field label="Fecha de baja" value={formatFecha(equipo.fechaBaja)} />
                  <div className="col-span-2">
                    <Field
                      label="Motivo"
                      value={equipo.motivoBaja
                        ? <span className="text-slate-700">{equipo.motivoBaja}</span>
                        : <span className="text-slate-300">Sin motivo registrado</span>
                      }
                    />
                  </div>
                </dl>
              </section>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
