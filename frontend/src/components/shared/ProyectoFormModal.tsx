import { useState, useEffect } from 'react';
import type { Proyecto, CreateProyectoData, UpdateProyectoData } from '../../types/proyecto.types';
import type { Cliente } from '../../services/clientes.service';
import { clientesService } from '../../services/clientes.service';
import { proyectosService } from '../../services/proyectos.service';
import { usuariosService } from '../../services/usuarios.service';
import { useAuthStore } from '../../store/auth.store';

interface EncargadoDisp {
  id:     string;
  nombre: string;
}

interface Props {
  proyecto?: Proyecto;
  isOpen:    boolean;
  onClose:   () => void;
  onGuardado: (p: Proyecto) => void;
}

export default function ProyectoFormModal({ proyecto, isOpen, onClose, onGuardado }: Props) {
  const esEdicion    = !!proyecto;
  const { user }     = useAuthStore();
  const esAdminOSec  = ['admin', 'secretaria'].includes(user?.role?.nombre ?? '');

  const [nombre,        setNombre]        = useState('');
  const [descripcion,   setDescripcion]   = useState('');
  const [clienteId,     setClienteId]     = useState('');
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [loadingCli,    setLoadingCli]    = useState(false);
  const [encargados,    setEncargados]    = useState<EncargadoDisp[]>([]);
  const [encargadoIds,  setEncargadoIds]  = useState<string[]>([]);
  const [loadingEnc,    setLoadingEnc]    = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [errores,       setErrores]       = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setErrores({});
    setEncargadoIds([]);
    if (proyecto) {
      setNombre(proyecto.nombre);
      setDescripcion(proyecto.descripcion ?? '');
      setClienteId(proyecto.clienteId);
    } else {
      setNombre('');
      setDescripcion('');
      setClienteId('');
    }
    if (!esEdicion) {
      setLoadingCli(true);
      clientesService.getAll()
        .then(data => { setClientes(data); if (data.length > 0) setClienteId(data[0].id); })
        .catch(() => setError('No se pudieron cargar los clientes.'))
        .finally(() => setLoadingCli(false));

      if (esAdminOSec) {
        setLoadingEnc(true);
        usuariosService.getAll()
          .then(data => {
            setEncargados(
              data
                .filter(u => u.isActive && u.role?.nombre === 'encargado_maquinas')
                .map(u => ({ id: u.id, nombre: u.nombre })),
            );
          })
          .finally(() => setLoadingEnc(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!nombre.trim())            e.nombre    = 'El nombre es requerido';
    if (!esEdicion && !clienteId)  e.clienteId = 'Selecciona un cliente';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const toggleEncargado = (id: string) => {
    setEncargadoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!validar()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let resultado: Proyecto;
      if (esEdicion) {
        const data: UpdateProyectoData = {
          nombre:      nombre.trim(),
          descripcion: descripcion.trim() || undefined,
        };
        resultado = await proyectosService.update(proyecto!.id, data);
      } else {
        const data: CreateProyectoData = {
          nombre:       nombre.trim(),
          descripcion:  descripcion.trim() || undefined,
          clienteId,
          encargadoIds: encargadoIds.length > 0 ? encargadoIds : undefined,
        };
        resultado = await proyectosService.create(data);
      }
      onGuardado(resultado);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo guardar el proyecto.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">
            {esEdicion ? 'Editar proyecto' : 'Nuevo proyecto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Nombre */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600">Nombre <span className="text-red-500">*</span></label>
              <span className="text-[10px] text-slate-400">{nombre.length}/120</span>
            </div>
            <input
              type="text"
              value={nombre}
              maxLength={120}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del proyecto"
              className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${errores.nombre ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'}`}
            />
            {errores.nombre && <p className="text-xs text-red-500 mt-1">{errores.nombre}</p>}
          </div>

          {/* Cliente */}
          {esEdicion ? (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Cliente</label>
              <p className="px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500">
                {proyecto!.cliente.nombre}
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Cliente <span className="text-red-500">*</span>
              </label>
              {loadingCli ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Cargando clientes...
                </div>
              ) : (
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 transition-all ${errores.clienteId ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'}`}
                >
                  <option value="">— Selecciona un cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              {errores.clienteId && <p className="text-xs text-red-500 mt-1">{errores.clienteId}</p>}
            </div>
          )}

          {/* Encargados — solo admin/sec en modo creación */}
          {!esEdicion && esAdminOSec && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  Encargados
                  <span className="text-[10px] font-normal text-slate-400">· Opcional</span>
                </label>
                {encargadoIds.length > 0 && (
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full leading-none">
                    {encargadoIds.length} seleccionado{encargadoIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {loadingEnc ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {[1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
                      <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : encargados.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 border border-slate-200 rounded-xl bg-slate-50">
                  No hay encargados activos registrados.
                </p>
              ) : (
                <div className="relative">
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {[
                      ...encargados.filter(e => encargadoIds.includes(e.id)),
                      ...encargados.filter(e => !encargadoIds.includes(e.id)),
                    ].map(enc => {
                      const seleccionado = encargadoIds.includes(enc.id);
                      const initials = enc.nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
                      return (
                        <button
                          key={enc.id}
                          type="button"
                          onClick={() => toggleEncargado(enc.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors select-none ${seleccionado ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-white hover:bg-slate-50'}`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 transition-colors"
                            style={{ background: seleccionado ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#94a3b8' }}
                          >
                            {initials}
                          </div>
                          <span className={`text-sm flex-1 leading-tight transition-colors ${seleccionado ? 'font-semibold text-indigo-700' : 'font-normal text-slate-700'}`}>
                            {enc.nombre}
                          </span>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${seleccionado ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                            {seleccionado && (
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="2 6 5 9 10 3" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {encargados.length > 3 && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-7 rounded-b-xl"
                      style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95), transparent)' }} />
                  )}
                </div>
              )}

              {!loadingEnc && encargados.length > 0 && encargadoIds.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Puedes agregar encargados después desde el detalle del proyecto.
                </p>
              )}
            </div>
          )}

          {/* Descripción */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600">Descripción</label>
              <span className="text-[10px] text-slate-400">{descripcion.length}/500</span>
            </div>
            <textarea
              value={descripcion}
              maxLength={500}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Descripción opcional del proyecto..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>

      </div>
    </div>
  );
}
