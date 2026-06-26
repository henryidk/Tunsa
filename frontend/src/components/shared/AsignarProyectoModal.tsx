import { useState, useEffect } from 'react';
import type { SolicitudRenta } from '../../types/solicitud-renta.types';
import type { ProyectoResumen } from '../../types/proyecto.types';
import { proyectosService } from '../../services/proyectos.service';

interface Props {
  solicitud:        SolicitudRenta;
  isOpen:           boolean;
  onClose:          () => void;
  onAsignado:       (proyectoId: string, nombre: string) => void;
  // Modo reasignación (admin/sec): permite quitar o cambiar proyecto
  proyectoActualId?: string | null;
  onReasignar?:      (proyectoId: string | null, nombre: string | null) => Promise<void>;
}

export default function AsignarProyectoModal({
  solicitud, isOpen, onClose, onAsignado,
  proyectoActualId, onReasignar,
}: Props) {
  const esReasignacion = onReasignar !== undefined;

  const [proyectos,    setProyectos]    = useState<ProyectoResumen[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [seleccionado, setSeleccionado] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSeleccionado(proyectoActualId ?? '');
    setError(null);
    setLoading(true);
    proyectosService.getMisProyectos()
      .then(data => {
        const filtrados = data.filter(p => p.clienteId === solicitud.clienteId);
        setProyectos(filtrados);
        if (!esReasignacion && filtrados.length > 0 && !proyectoActualId) {
          setSeleccionado(filtrados[0].id);
        }
      })
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  }, [isOpen, solicitud.clienteId, proyectoActualId, esReasignacion]);

  const handleAsignar = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (esReasignacion) {
        const nombre = seleccionado ? (proyectos.find(p => p.id === seleccionado)?.nombre ?? null) : null;
        await onReasignar!(seleccionado || null, nombre);
      } else {
        if (!seleccionado) return;
        await proyectosService.asignarSolicitud(solicitud.id, seleccionado);
        const nombre = proyectos.find(p => p.id === seleccionado)?.nombre ?? seleccionado;
        onAsignado(seleccionado, nombre);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo asignar el proyecto.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const tituloModal = esReasignacion ? 'Reasignar proyecto' : 'Asignar a proyecto';
  const btnLabel    = isSubmitting
    ? (esReasignacion ? 'Guardando...' : 'Asignando...')
    : (esReasignacion ? 'Guardar' : 'Asignar');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">{tituloModal}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Renta</p>
            <p className="text-sm font-semibold text-slate-800">{solicitud.folio ?? solicitud.id}</p>
            <p className="text-xs text-slate-400">{solicitud.cliente.nombre}</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Cargando proyectos...
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Proyecto</label>
              {proyectos.length === 0 && !esReasignacion ? (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5 text-slate-400">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  No hay proyectos disponibles para ti en este cliente. Si el cliente tiene proyectos activos, pide a un administrador que te asigne.
                </div>
              ) : (
                <select
                  value={seleccionado}
                  onChange={e => setSeleccionado(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {esReasignacion && (
                    <option value="">— Sin proyecto —</option>
                  )}
                  {proyectos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          {(!loading && (esReasignacion || proyectos.length > 0)) && (
            <button
              onClick={handleAsignar}
              disabled={(!esReasignacion && !seleccionado) || isSubmitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {btnLabel}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
