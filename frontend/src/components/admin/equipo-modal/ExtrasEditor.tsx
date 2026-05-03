import { useState } from 'react';
import { extrasService, type TipoExtra } from '../../../services/equipos.service';

export interface ExtraActivo {
  tipoExtraId: string;
  rentaHora:   string;
}

interface Props {
  tiposExtra:    TipoExtra[];
  extrasActivos: ExtraActivo[];
  disabled:      boolean;
  onToggle:      (tipoExtraId: string) => void;
  onUpdatePrice: (tipoExtraId: string, precio: string) => void;
  onTipoCreado:  (nuevo: TipoExtra) => void;
}

interface NuevoTipoForm {
  nombre:      string;
  descripcion: string;
}

export default function ExtrasEditor({
  tiposExtra, extrasActivos, disabled, onToggle, onUpdatePrice, onTipoCreado,
}: Props) {
  const [mostrando,   setMostrando]   = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [nuevoTipo,   setNuevoTipo]   = useState<NuevoTipoForm>({ nombre: '', descripcion: '' });
  const [errorInline, setErrorInline] = useState<string | null>(null);

  const abrirFormNuevo = () => {
    setNuevoTipo({ nombre: '', descripcion: '' });
    setErrorInline(null);
    setMostrando(true);
  };

  const cancelarNuevo = () => setMostrando(false);

  const crearTipo = async () => {
    const nombre = nuevoTipo.nombre.trim();
    if (!nombre) { setErrorInline('El nombre es obligatorio.'); return; }
    if (nombre.length > 60) { setErrorInline('Máximo 60 caracteres.'); return; }

    setGuardando(true);
    setErrorInline(null);
    try {
      const creado = await extrasService.create({
        nombre,
        descripcion: nuevoTipo.descripcion.trim() || undefined,
      });
      onTipoCreado(creado);
      onToggle(creado.id);
      setMostrando(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorInline(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo crear el complemento.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500">Complementos del equipo</p>
        {!mostrando && (
          <button
            type="button"
            onClick={abrirFormNuevo}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo tipo
          </button>
        )}
      </div>

      {tiposExtra.length === 0 && !mostrando && (
        <p className="text-xs text-slate-400 py-2">
          No hay complementos en el catálogo. Crea el primero con "Nuevo tipo".
        </p>
      )}

      {tiposExtra.map(te => {
        const activo = extrasActivos.find(e => e.tipoExtraId === te.id);
        return (
          <div
            key={te.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
              activo
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(te.id)}
              disabled={disabled}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                activo
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-300 bg-white hover:border-indigo-400'
              } disabled:opacity-50`}
            >
              {activo && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${activo ? 'text-indigo-800' : 'text-slate-600'}`}>
                {te.nombre}
              </p>
              {te.descripcion && (
                <p className="text-[10px] text-slate-400 truncate">{te.descripcion}</p>
              )}
            </div>

            {activo && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-slate-500 font-mono">Q</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={activo.rentaHora}
                  onChange={e => onUpdatePrice(te.id, e.target.value)}
                  disabled={disabled}
                  placeholder="0.00"
                  className="w-20 border border-slate-200 rounded-md px-2 py-1 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400">/hr</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Formulario inline para nuevo tipo */}
      {mostrando && (
        <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Nuevo complemento</p>

          <input
            type="text"
            value={nuevoTipo.nombre}
            onChange={e => { setNuevoTipo(p => ({ ...p, nombre: e.target.value })); setErrorInline(null); }}
            placeholder="Nombre (ej: Martillo)"
            maxLength={60}
            disabled={guardando}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:opacity-60"
          />

          <input
            type="text"
            value={nuevoTipo.descripcion}
            onChange={e => setNuevoTipo(p => ({ ...p, descripcion: e.target.value }))}
            placeholder="Descripción (opcional)"
            maxLength={200}
            disabled={guardando}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:opacity-60"
          />

          {errorInline && (
            <p className="text-[11px] text-red-600 font-medium">{errorInline}</p>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={cancelarNuevo}
              disabled={guardando}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={crearTipo}
              disabled={guardando || !nuevoTipo.nombre.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando && (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              )}
              Crear y activar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
