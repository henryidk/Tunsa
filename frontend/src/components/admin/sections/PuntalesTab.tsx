// PuntalesTab.tsx — inventario de puntales (lotes históricos + stock total)

import { useState, useEffect } from 'react';
import { puntalesService } from '../../../services/puntales.service';
import type { PuntalLote, PuntalesConfig } from '../../../services/puntales.service';
import AgregarPuntalModal from '../AgregarPuntalModal';
import PreciosPuntalesModal from '../PreciosPuntalesModal';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onShowToast?: (type: ToastType, title: string, msg: string) => void;
  canEdit?: boolean;
}

function formatFecha(iso: string | null) {
  if (!iso) return <span className="text-slate-300">—</span>;
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatQ(n: number) {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PuntalesTab({ onShowToast = () => {}, canEdit = true }: Props) {
  const [lotes,      setLotes]      = useState<PuntalLote[]>([]);
  const [config,     setConfig]     = useState<PuntalesConfig | null>(null);
  const [stockTotal, setStockTotal] = useState(0);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [modalOpen,         setModalOpen]         = useState(false);
  const [preciosModalOpen,  setPreciosModalOpen]  = useState(false);

  useEffect(() => {
    puntalesService.getAll()
      .then(data => {
        setLotes(data.lotes);
        setStockTotal(data.stockTotal);
        setConfig(data.config);
      })
      .catch(() => setError('No se pudo cargar el inventario de puntales.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleLoteCreado = (lote: PuntalLote) => {
    setLotes(prev => [...prev, lote]);
    setStockTotal(prev => prev + lote.cantidad);
    onShowToast('success', 'Lote registrado', `Se agregaron ${lote.cantidad} unidades al inventario.`);
  };

  const handlePreciosGuardados = (updated: PuntalesConfig) => {
    setConfig(updated);
    setPreciosModalOpen(false);
    onShowToast('success', 'Precios actualizados', 'Las tarifas de renta de puntales fueron guardadas.');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-slate-500 mt-1">Historial de lotes y stock disponible</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPreciosModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Editar precios
            </button>
            <button onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nuevo lote
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Stock total */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-indigo-600">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">
              {isLoading ? '—' : stockTotal.toLocaleString('es-GT')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Unidades en inventario</div>
          </div>
        </div>

        {/* Precios */}
        {config && (
          <>
            {[
              { label: 'Por día',    value: config.rentaDia },
              { label: 'Por semana', value: config.rentaSemana },
              { label: 'Por mes',    value: config.rentaMes },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm">
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{label}</div>
                <div className="text-lg font-bold text-slate-800 font-mono">{formatQ(value)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">por unidad</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Tabla de lotes */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Historial de lotes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Descripción', 'Cantidad', 'Precio unit.', 'Monto total', 'Fecha compra', 'Ubicación'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Cargando inventario...</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
              )}
              {!isLoading && !error && lotes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No hay lotes registrados.</td></tr>
              )}
              {!isLoading && !error && lotes.map(lote => (
                <tr key={lote.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{lote.descripcion}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {lote.cantidad.toLocaleString('es-GT')} uds.
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{formatQ(lote.precioUnitario)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                    {formatQ(lote.cantidad * lote.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatFecha(lote.fechaCompra)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {lote.ubicacion ?? <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && lotes.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">{lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
            <span className="text-xs font-semibold text-slate-600">
              Total invertido: {formatQ(lotes.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0))}
            </span>
          </div>
        )}
      </div>

      <AgregarPuntalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleLoteCreado}
      />

      <PreciosPuntalesModal
        config={config}
        open={preciosModalOpen}
        onClose={() => setPreciosModalOpen(false)}
        onSave={handlePreciosGuardados}
      />
    </div>
  );
}
