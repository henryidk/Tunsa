// NuevaSolicitudSection.tsx — orquestador del formulario de nueva solicitud

import { useState, useMemo } from 'react';
import ClienteSearchWidget from '../../ClienteSearchWidget';
import MaquinariaPickerForm from '../MaquinariaPickerForm';
import GranelPickerSection from '../GranelPickerSection';
import type { Cliente } from '../../../services/clientes.service';
import type { ItemSolicitud, ItemMaquinaria } from '../../../types/solicitud.types';
import { calcSubtotal, formatQ, formatFechaCorta, unidadLabel, rateSuffix, getRentaRate } from '../../../types/solicitud.types';
import { useSolicitudData } from '../../../hooks/useSolicitudData';
import { useSolicitudCart } from '../../../hooks/useSolicitudCart';

interface Props {
  onNavTo?: (section: string) => void;
}

export default function NuevaSolicitudSection(_props: Props) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [notas,               setNotas]               = useState('');
  const [equipoTab, setEquipoTab] = useState<'maquinaria' | 'granel'>('maquinaria');

  const { equiposLiviana, granelData, isLoading, error: dataError } = useSolicitudData();
  const cart = useSolicitudCart();

  // Equipos disponibles: activos, liviana, y no ya en el carrito
  const equiposDisponibles = useMemo(
    () => equiposLiviana.filter(e => !cart.hasEquipo(e.id)),
    [equiposLiviana, cart.items],
  );

  const handleLimpiar = () => {
    cart.clear();
    setClienteSeleccionado(null);
    setNotas('');
    // Los sub-formularios manejan su propio estado y se limpian internamente al agregar;
    // el tab se mantiene donde estaba para no perder contexto del usuario.
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Solicitud de Renta</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registra los datos del cliente y agrega los equipos que necesita rentar
        </p>
      </div>

      {dataError && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {dataError}
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 1. Cliente */}
          <SectionCard
            icon={<UserIcon />}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            title="Cliente de la Solicitud"
            subtitle={clienteSeleccionado
              ? 'Cliente seleccionado — haz clic en × para cambiar'
              : 'Busca un cliente registrado o regístralo desde aquí'}
          >
            <ClienteSearchWidget onSelect={setClienteSeleccionado} />
          </SectionCard>

          {/* 2. Equipos */}
          <SectionCard
            icon={<EquipoIcon />}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            title="Equipos / Maquinaria"
            subtitle="Cada ítem tiene su propia fecha de inicio y duración"
            locked={!clienteSeleccionado}
          >
            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
              {([
                { id: 'maquinaria' as const, label: 'Maquinaria liviana' },
                { id: 'granel'     as const, label: 'A granel'           },
              ]).map(t => (
                <button key={t.id} onClick={() => setEquipoTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    equipoTab === t.id
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {equipoTab === 'maquinaria' && (
              <div className="mb-5">
                <MaquinariaPickerForm
                  equiposDisponibles={equiposDisponibles}
                  isLoading={isLoading}
                  onAdd={item => cart.addMaquinaria(item)}
                />
              </div>
            )}

            {equipoTab === 'granel' && (
              <div className="mb-5">
                <GranelPickerSection
                  granelData={granelData}
                  isLoading={isLoading}
                  inCart={tipo => cart.hasGranel(tipo)}
                  onAdd={item => cart.addGranel(item)}
                />
              </div>
            )}

            <CartTable items={cart.items} onRemove={cart.removeAt} summary={cart.summary} />
          </SectionCard>

          {/* 3. Notas */}
          <SectionCard
            icon={<NotasIcon />}
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            title="Notas / Observaciones"
            subtitle="Condiciones especiales o acuerdos adicionales (opcional)"
            locked={!clienteSeleccionado}
          >
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ej: El cliente necesita entrega en obra, pago en efectivo, etc."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </SectionCard>

        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <SolicitudResumen
          cliente={clienteSeleccionado}
          items={cart.items}
          summary={cart.summary}
          onLimpiar={handleLimpiar}
          canLimpiar={cart.items.length > 0 || !!clienteSeleccionado || !!notas}
          canEnviar={!!clienteSeleccionado && cart.items.length > 0}
        />

      </div>
    </div>
  );
}

// ── Sub-components (layout-only, sin lógica de negocio) ───────────────────────

interface SectionCardProps {
  icon:       React.ReactNode;
  iconBg:     string;
  iconColor:  string;
  title:      string;
  subtitle:   string;
  children:   React.ReactNode;
  locked?:    boolean;
}

function SectionCard({ icon, iconBg, iconColor, title, subtitle, children, locked = false }: SectionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconColor} flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <div className="relative">
        <div className={`px-5 py-5${locked ? ' select-none pointer-events-none opacity-40' : ''}`}>
          {children}
        </div>
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs font-medium text-slate-500">Selecciona un cliente primero</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CartTableProps {
  items:    ItemSolicitud[];
  onRemove: (idx: number) => void;
  summary:  { total: number; countMaquinaria: number; countGranel: number };
}

function CartTable({ items, onRemove, summary }: CartTableProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs text-slate-400 font-medium">Ítems en la solicitud ({items.length})</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Equipo / Instrumento', 'Cant.', 'Inicio', 'Duración', 'Tarifa', 'Subtotal', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M22 12H18L15 21L9 3L6 12H2"/>
                    </svg>
                    <p className="text-sm">Aún no has agregado equipos</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <CartRow key={item.kind === 'maquinaria' ? item.equipo.id : `granel-${item.tipo}`}
                  item={item} onRemove={() => onRemove(idx)} />
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {[
                summary.countMaquinaria > 0 ? `${summary.countMaquinaria} equipo${summary.countMaquinaria > 1 ? 's' : ''}` : null,
                summary.countGranel > 0 ? `${summary.countGranel} granel` : null,
              ].filter(Boolean).join(' · ')}
            </span>
            <span className="text-xs font-bold text-slate-700 font-mono">Total: {formatQ(summary.total)}</span>
          </div>
        )}
      </div>
    </>
  );
}

interface CartRowProps {
  item:     ItemSolicitud;
  onRemove: () => void;
}

function CartRow({ item, onRemove }: CartRowProps) {
  const subtotal = calcSubtotal(item);
  const tarifa = item.kind === 'maquinaria'
    ? getRentaRate(item.unidad, item.equipo.rentaDia, item.equipo.rentaSemana, item.equipo.rentaMes)
    : item.config
      ? getRentaRate(item.unidad, item.config.rentaDia, item.config.rentaSemana, item.config.rentaMes)
      : null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="px-3 py-3">
        {item.kind === 'maquinaria' ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              #{item.equipo.numeracion}
            </span>
            <span className="text-xs font-medium text-slate-800 truncate max-w-[150px]">
              {item.equipo.descripcion}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
              Granel
            </span>
            <span className="text-xs font-medium text-slate-800">{item.tipoLabel}</span>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-slate-600">
        {item.kind === 'granel' ? item.cantidad.toLocaleString('es-GT') : '—'}
      </td>
      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatFechaCorta(item.fechaInicio)}
      </td>
      <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
        {unidadLabel(item.duracion, item.unidad)}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
        {tarifa !== null
          ? <>{formatQ(tarifa)}<span className="text-slate-400">{rateSuffix(item.unidad)}{item.kind === 'granel' ? '/u' : ''}</span></>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-3 text-xs font-mono font-bold text-slate-800 whitespace-nowrap">
        {formatQ(subtotal)}
      </td>
      <td className="px-3 py-3">
        <button onClick={onRemove}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  );
}

interface SolicitudResumenProps {
  cliente:     Cliente | null;
  items:       ItemSolicitud[];
  summary:     { total: number; countMaquinaria: number; countGranel: number };
  onLimpiar:   () => void;
  canLimpiar:  boolean;
  canEnviar:   boolean;
}

function SolicitudResumen({ cliente, items, summary, onLimpiar, canLimpiar, canEnviar }: SolicitudResumenProps) {
  return (
    <div className="w-72 flex-shrink-0">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-20">

        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Resumen</div>
            <div className="text-xs text-slate-500">Detalle y total estimado</div>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cliente</div>
          {cliente ? (
            <>
              <p className="text-sm font-semibold text-slate-800 truncate">{cliente.nombre}</p>
              <p className="text-xs text-slate-400 font-mono">{cliente.id}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin cliente seleccionado</p>
          )}
        </div>

        {/* Items list */}
        <div className="px-5 py-3 border-b border-slate-100 max-h-60 overflow-y-auto">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Ítems ({items.length})
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <p className="text-xs text-center">Nada agregado aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.kind === 'maquinaria' ? item.equipo.id : `granel-${item.tipo}`}
                  className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {item.kind === 'maquinaria' ? (
                      <p className="text-xs font-medium text-slate-700 truncate">
                        <span className="font-mono text-[10px] text-slate-400">#{item.equipo.numeracion} </span>
                        {item.equipo.descripcion}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-slate-700">
                        {item.tipoLabel}<span className="text-slate-400"> × {item.cantidad}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{unidadLabel(item.duracion, item.unidad)}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-700 flex-shrink-0">
                    {formatQ(calcSubtotal(item))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="px-5 py-4 bg-slate-50">
          <span className="text-xs text-slate-500 font-medium">Total estimado</span>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">
            <span className="text-base font-semibold text-slate-500 mr-0.5">Q</span>
            {summary.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {items.length === 0 ? '0 ítems seleccionados' : [
              summary.countMaquinaria > 0 ? `${summary.countMaquinaria} equipo${summary.countMaquinaria > 1 ? 's' : ''}` : null,
              summary.countGranel > 0 ? `${summary.countGranel} granel` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 flex gap-2 border-t border-slate-100">
          <button onClick={onLimpiar} disabled={!canLimpiar}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Limpiar
          </button>
          <button disabled={!canEnviar}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
            </svg>
            Enviar Solicitud
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Iconos (SVG inline, sin dependencia externa) ──────────────────────────────

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function EquipoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

function NotasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
