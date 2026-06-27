import { useState, useEffect, useMemo } from 'react';
import type { Proyecto, ProyectoSolicitudes, EstadoProyecto } from '../../types/proyecto.types';
import type { SolicitudRenta, ItemSnapshot } from '../../types/solicitud-renta.types';
import type { TonoSistema } from '../../types/tono.types';
import type { EncargadoProyecto } from '../../services/proyectos.service';
import { TONO_INDIGO } from '../../types/tono.types';
import { proyectosService } from '../../services/proyectos.service';
import { usuariosService } from '../../services/usuarios.service';
import { formatFecha } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import ProyectoFormModal from './ProyectoFormModal';
import ProyectoBadge from './ProyectoBadge';

interface Props {
  tono?:    TonoSistema;
  onNavTo?: (section: string, state?: Record<string, string>) => void;
}

type Vista = 'lista' | 'detalle';

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProyectosSection({ tono = TONO_INDIGO, onNavTo: _onNavTo }: Props) {
  const [vista,                setVista]                = useState<Vista>('lista');
  const [proyectos,            setProyectos]            = useState<Proyecto[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState<string | null>(null);
  const [busqueda,             setBusqueda]             = useState('');
  const [filtroEstado,         setFiltroEstado]         = useState<'' | EstadoProyecto>('');
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<Proyecto | null>(null);
  const [solicitudesProyecto,  setSolicitudesProyecto]  = useState<ProyectoSolicitudes | null>(null);
  const [loadingDetalle,       setLoadingDetalle]       = useState(false);
  const [modalForm,            setModalForm]            = useState<{ proyecto?: Proyecto } | null>(null);
  const [confirmFinalizar,     setConfirmFinalizar]     = useState<Proyecto | null>(null);
  const [finalizando,          setFinalizando]          = useState(false);
  const [errorFinalizar,       setErrorFinalizar]       = useState<string | null>(null);

  const cargarProyectos = () => {
    setLoading(true);
    setError(null);
    proyectosService.getAll()
      .then(setProyectos)
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargarProyectos(); }, []);

  const verDetalle = async (proyecto: Proyecto) => {
    setProyectoSeleccionado(proyecto);
    setSolicitudesProyecto(null);
    setVista('detalle');
    setLoadingDetalle(true);
    try {
      const data = await proyectosService.getSolicitudes(proyecto.id);
      setSolicitudesProyecto(data);
    } catch {
      // se muestra estado vacío
    } finally {
      setLoadingDetalle(false);
    }
  };

  const volverALista = () => {
    setVista('lista');
    setProyectoSeleccionado(null);
    setSolicitudesProyecto(null);
  };

  const handleGuardado = (p: Proyecto) => {
    setModalForm(null);
    setProyectos(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n; }
      return [p, ...prev];
    });
    if (proyectoSeleccionado?.id === p.id) setProyectoSeleccionado(p);
  };

  const handleFinalizar = async () => {
    if (!confirmFinalizar) return;
    setFinalizando(true);
    setErrorFinalizar(null);
    try {
      const actualizado = await proyectosService.finalizar(confirmFinalizar.id);
      setProyectos(prev => prev.map(p => p.id === actualizado.id ? actualizado : p));
      if (proyectoSeleccionado?.id === actualizado.id) setProyectoSeleccionado(actualizado);
      setConfirmFinalizar(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorFinalizar(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo finalizar el proyecto.'));
    } finally {
      setFinalizando(false);
    }
  };

  const handleReactivar = async (proyecto: Proyecto) => {
    try {
      const actualizado = await proyectosService.reactivar(proyecto.id);
      setProyectos(prev => prev.map(p => p.id === actualizado.id ? actualizado : p));
      if (proyectoSeleccionado?.id === actualizado.id) setProyectoSeleccionado(actualizado);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'No se pudo reactivar el proyecto.'));
    }
  };

  const filtrados = useMemo(() => {
    let list = proyectos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) || p.cliente.nombre.toLowerCase().includes(q),
      );
    }
    if (filtroEstado) list = list.filter(p => p.estado === filtroEstado);
    return [...list].sort((a, b) => {
      if (a.estado === b.estado) return 0;
      return a.estado === 'ACTIVO' ? -1 : 1;
    });
  }, [proyectos, busqueda, filtroEstado]);

  const totalActivos     = proyectos.filter(p => p.estado === 'ACTIVO').length;
  const totalFinalizados = proyectos.filter(p => p.estado === 'FINALIZADO').length;

  return (
    <div>
      {/* Modales */}
      {modalForm !== null && (
        <ProyectoFormModal
          proyecto={modalForm.proyecto}
          isOpen
          onClose={() => setModalForm(null)}
          onGuardado={handleGuardado}
        />
      )}
      {confirmFinalizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm px-6 py-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">¿Finalizar proyecto?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              El proyecto <span className="font-medium text-slate-700">{confirmFinalizar.nombre}</span> pasará
              a estado <span className="font-medium">FINALIZADO</span>. Solo puede finalizarse si no tiene
              rentas activas o vencidas.
            </p>
            {errorFinalizar && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorFinalizar}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmFinalizar(null); setErrorFinalizar(null); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizar}
                disabled={finalizando}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white disabled:opacity-60"
              >
                {finalizando ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista detalle ─────────────────────────────────────────────────── */}
      {vista === 'detalle' && proyectoSeleccionado && (
        <DetalleProyecto
          proyecto={proyectoSeleccionado}
          solicitudes={solicitudesProyecto}
          loading={loadingDetalle}
          onVolver={volverALista}
          onEditar={() => setModalForm({ proyecto: proyectoSeleccionado })}
          onFinalizar={() => { setErrorFinalizar(null); setConfirmFinalizar(proyectoSeleccionado); }}
          onReactivar={() => handleReactivar(proyectoSeleccionado)}
        />
      )}

      {/* ── Vista lista ───────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Proyectos</h1>
              <p className="text-sm text-slate-500 mt-1">
                <span className="font-medium text-emerald-600">{totalActivos}</span> activos ·{' '}
                <span className="font-medium text-slate-400">{totalFinalizados}</span> finalizados
              </p>
            </div>
            <button
              onClick={() => setModalForm({})}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${tono.boton} text-sm font-semibold ${tono.botonTexto} transition-colors`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nuevo proyecto
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o cliente..."
              className={`w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none ${tono.foco}`}
            />
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white text-sm font-medium">
              {(['', 'ACTIVO', 'FINALIZADO'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-2 transition-colors ${filtroEstado === e ? `${tono.acentoFuerte}` : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {e === '' ? 'Todos' : e === 'ACTIVO' ? 'Activos' : 'Finalizados'}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>
          )}

          {/* Contenido */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <EstadoVacio busqueda={busqueda.length > 0 || !!filtroEstado} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtrados.map(p => (
                <ProyectoCard
                  key={p.id}
                  proyecto={p}
                  onVerDetalle={() => verDetalle(p)}
                  onEditar={() => setModalForm({ proyecto: p })}
                  onFinalizar={() => { setErrorFinalizar(null); setConfirmFinalizar(p); }}
                  onReactivar={() => handleReactivar(p)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ProyectoCard ─────────────────────────────────────────────────────────────

function ProyectoCard({
  proyecto, onVerDetalle, onEditar, onFinalizar, onReactivar,
}: {
  proyecto:     Proyecto;
  onVerDetalle: () => void;
  onEditar:     () => void;
  onFinalizar:  () => void;
  onReactivar:  () => void;
}) {
  const esActivo = proyecto.estado === 'ACTIVO';

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md ${
      esActivo ? 'border-slate-200' : 'border-slate-100 opacity-75'
    }`}>
      {/* Top bar de color */}
      <div className={`h-1 w-full ${esActivo ? 'bg-emerald-400' : 'bg-slate-300'}`} />

      <div className="p-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-snug">{proyecto.nombre}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{proyecto.cliente.nombre}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            esActivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {proyecto.estado}
          </span>
        </div>

        {/* Grid de 4 contadores */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {([
            { label: 'Inicio',  value: formatFecha(proyecto.fechaInicio)                                                                                   },
            { label: 'Rentas',  value: `${proyecto.solicitudesActivas} activas`                                                                            },
            { label: 'Equipos', value: `${proyecto.equiposEnCampo} en campo`                                                                              },
            { label: 'Total',   value: proyecto.costoAcumulado > 0
                ? `Q ${proyecto.costoAcumulado.toLocaleString('es-GT', { minimumFractionDigits: 0 })}`
                : '—',
              mono: true },
          ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide leading-none">{label}</p>
              <p className={`text-xs font-semibold text-slate-700 mt-1 leading-tight ${mono ? 'font-mono' : ''}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={onVerDetalle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          >
            Ver detalle
          </button>
          <div className="flex-1" />
          <button
            onClick={onEditar}
            title="Editar proyecto"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {esActivo ? (
            <button
              onClick={onFinalizar}
              disabled={proyecto.solicitudesActivas > 0}
              title={proyecto.solicitudesActivas > 0 ? 'Hay rentas activas' : 'Finalizar proyecto'}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={onReactivar}
              title="Reactivar proyecto"
              className="p-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-500 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers de salud y estadísticas ──────────────────────────────────────────

function calcSalud(
  proyecto:    Proyecto,
  solicitudes: ProyectoSolicitudes | null,
): { label: string; cls: string } {
  if (proyecto.estado === 'FINALIZADO') return { label: 'Finalizado',   cls: 'bg-slate-100 text-slate-500'     };
  if (!solicitudes)                      return { label: '…',            cls: 'bg-slate-100 text-slate-400'     };
  if (solicitudes.vencidas.length > 0)  return { label: 'Atención',     cls: 'bg-red-100 text-red-600'         };
  if (solicitudes.activas.length > 0)   return { label: 'Saludable',    cls: 'bg-emerald-100 text-emerald-700' };
  return { label: 'Sin actividad', cls: 'bg-slate-100 text-slate-500' };
}

function SaludProyecto({ proyecto, solicitudes }: {
  proyecto:    Proyecto;
  solicitudes: ProyectoSolicitudes | null;
}) {
  const { label, cls } = calcSalud(proyecto, solicitudes);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

function ProyectoStatCards({ proyecto }: { proyecto: Proyecto }) {
  const diasActivo = Math.max(0, Math.floor(
    (Date.now() - new Date(proyecto.fechaInicio).getTime()) / 86_400_000,
  ));

  const stats: { valor: string; label: string; cls: string }[] = [
    {
      valor: proyecto.costoAcumulado > 0
        ? `Q ${proyecto.costoAcumulado.toLocaleString('es-GT', { minimumFractionDigits: 0 })}`
        : '—',
      label: 'Total',
      cls:   'text-slate-900 font-mono',
    },
    { valor: String(proyecto.solicitudesActivas), label: 'Rentas',  cls: 'text-blue-600'   },
    { valor: String(proyecto.equiposEnCampo),     label: 'Equipos', cls: 'text-amber-600'  },
    { valor: `${diasActivo}d`,                    label: 'Activo',  cls: 'text-violet-700' },
  ];

  return (
    <div className="flex items-stretch border border-slate-200 rounded-[10px] overflow-hidden flex-shrink-0">
      {stats.map(({ valor, label, cls }, i) => (
        <div
          key={label}
          className={`px-[18px] py-[10px] text-center min-w-[88px] bg-white ${i < stats.length - 1 ? 'border-r border-slate-200' : ''}`}
        >
          <p className={`text-base font-bold leading-none ${cls}`}>{valor}</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1.5 uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── DetalleProyecto ──────────────────────────────────────────────────────────

function DetalleProyecto({
  proyecto, solicitudes, loading, onVolver, onEditar, onFinalizar, onReactivar,
}: {
  proyecto:    Proyecto;
  solicitudes: ProyectoSolicitudes | null;
  loading:     boolean;
  onVolver:    () => void;
  onEditar:    () => void;
  onFinalizar: () => void;
  onReactivar: () => void;
}) {
  const esActivo   = proyecto.estado === 'ACTIVO';
  const { user }   = useAuthStore();
  const esAdmin    = user?.role?.nombre === 'admin' || user?.role?.nombre === 'secretaria';

  return (
    <div>
      {/* Volver */}
      <button
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver a proyectos
      </button>

      {/* Header card */}
      <div className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-[18px] flex items-center gap-4 flex-wrap">
        {/* Bloque izquierdo */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-[17px] font-bold text-slate-900 leading-snug">{proyecto.nombre}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${esActivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {proyecto.estado}
            </span>
            <SaludProyecto proyecto={proyecto} solicitudes={solicitudes} />
          </div>
          <p className="text-xs text-slate-500">
            {proyecto.cliente.nombre} · desde {formatFecha(proyecto.fechaInicio)}
            {proyecto.fechaFin && ` · Finalizado ${formatFecha(proyecto.fechaFin)}`}
          </p>
          {proyecto.descripcion && (
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{proyecto.descripcion}</p>
          )}
        </div>

        {/* Stat cards */}
        <ProyectoStatCards proyecto={proyecto} />

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEditar}
            className="px-[14px] py-[7px] rounded-[10px] border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Editar
          </button>
          {esActivo ? (
            <button
              onClick={onFinalizar}
              disabled={proyecto.solicitudesActivas > 0}
              title={proyecto.solicitudesActivas > 0 ? 'Hay rentas activas o vencidas' : undefined}
              className="px-[14px] py-[7px] rounded-[10px] border border-slate-200 bg-white text-xs font-medium text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Finalizar
            </button>
          ) : (
            <button
              onClick={onReactivar}
              className="px-[14px] py-[7px] rounded-[10px] border border-emerald-200 bg-white text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Reactivar
            </button>
          )}
        </div>
      </div>

      {/* Encargados (solo admin/sec) */}
      {esAdmin && (
        <EncargadosBlock proyectoId={proyecto.id} />
      )}

      {/* Rentas del proyecto */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !solicitudes ? (
        <p className="text-sm text-slate-400 text-center py-16">No se pudieron cargar las rentas del proyecto.</p>
      ) : (
        <div className="space-y-4">
          {solicitudes.enProceso.length > 0 && (
            <GrupoRentas titulo="En proceso" color="amber" solicitudes={solicitudes.enProceso} />
          )}
          {solicitudes.activas.length > 0 && (
            <GrupoRentas titulo="Activas" color="emerald" solicitudes={solicitudes.activas} />
          )}
          {solicitudes.vencidas.length > 0 && (
            <GrupoRentas titulo="Vencidas" color="red" solicitudes={solicitudes.vencidas} />
          )}
          {solicitudes.devueltas.length > 0 && (
            <GrupoHistorial titulo="Historial" solicitudes={solicitudes.devueltas} />
          )}
          {solicitudes.enProceso.length === 0 && solicitudes.activas.length === 0 &&
           solicitudes.vencidas.length === 0 && solicitudes.devueltas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-sm font-medium">Sin rentas en este proyecto</p>
              <p className="text-xs text-center max-w-xs leading-relaxed">
                Las rentas asignadas a este proyecto aparecerán aquí.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EncargadosBlock ───────────────────────────────────────────────────────────

function EncargadosBlock({ proyectoId }: { proyectoId: string }) {
  const [encargados,    setEncargados]    = useState<EncargadoProyecto[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [todos,         setTodos]         = useState<{ id: string; nombre: string }[]>([]);
  const [selUsuario,    setSelUsuario]    = useState('');
  const [confirmQuitar, setConfirmQuitar] = useState<string | null>(null);
  const [savingAdd,     setSavingAdd]     = useState(false);
  const [savingRemove,  setSavingRemove]  = useState(false);
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      proyectosService.getEncargados(proyectoId),
      usuariosService.getAll(),
    ])
      .then(([encs, usuarios]) => {
        setEncargados(encs);
        setTodos(
          usuarios
            .filter(u => u.isActive && u.role.nombre === 'encargado_maquinas')
            .map(u => ({ id: u.id, nombre: u.nombre })),
        );
      })
      .catch(() => setError('No se pudieron cargar los encargados.'))
      .finally(() => setLoading(false));
  }, [proyectoId]);

  const asignadosIds = new Set(encargados.map(e => e.usuarioId));
  const disponibles  = todos.filter(u => !asignadosIds.has(u.id));

  const handleAgregar = async () => {
    if (!selUsuario) return;
    setSavingAdd(true);
    setErrorMutacion(null);
    try {
      const updated = await proyectosService.agregarEncargado(proyectoId, selUsuario);
      setEncargados(updated);
      setSelUsuario('');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMutacion(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al agregar encargado.'));
    } finally {
      setSavingAdd(false);
    }
  };

  const handleQuitar = async (usuarioId: string) => {
    setSavingRemove(true);
    setErrorMutacion(null);
    try {
      const updated = await proyectosService.quitarEncargado(proyectoId, usuarioId);
      setEncargados(updated);
      setConfirmQuitar(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMutacion(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al quitar encargado.'));
      setConfirmQuitar(null);
    } finally {
      setSavingRemove(false);
    }
  };

  return (
    <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Encargados</p>

      {loading ? (
        <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Cargando...
        </div>
      ) : error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {encargados.length === 0 ? (
              <p className="text-xs text-slate-400">Sin encargados asignados. Usa el selector de abajo para agregar uno.</p>
            ) : encargados.map(e => (
              <div key={e.usuarioId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                    {e.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700">{e.nombre}</span>
                  {e.esCreador && (
                    <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">creador</span>
                  )}
                </div>
                {!e.esCreador && (
                  confirmQuitar === e.usuarioId ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuitar(e.usuarioId)}
                        disabled={savingRemove}
                        className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                      >
                        {savingRemove ? '...' : 'Quitar'}
                      </button>
                      <button
                        onClick={() => setConfirmQuitar(null)}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmQuitar(e.usuarioId)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Quitar encargado"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )
                )}
              </div>
            ))}
          </div>

          {errorMutacion && (
            <p className="text-xs text-red-500 mb-2">{errorMutacion}</p>
          )}

          {disponibles.length > 0 && (
            <div className="flex gap-2 items-center pt-2 border-t border-slate-100">
              <select
                value={selUsuario}
                onChange={e => setSelUsuario(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
              >
                <option value="">— Seleccionar usuario —</option>
                {disponibles.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
              <button
                onClick={handleAgregar}
                disabled={!selUsuario || savingAdd}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                {savingAdd ? '...' : 'Agregar'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── GrupoRentas ───────────────────────────────────────────────────────────────

type ColorGrupo = 'amber' | 'emerald' | 'red' | 'slate';

const colorMap: Record<ColorGrupo, { dot: string; badge: string }> = {
  amber:   { dot: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50 border-amber-200'        },
  emerald: { dot: 'bg-emerald-400', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200'  },
  red:     { dot: 'bg-red-400',     badge: 'text-red-700 bg-red-50 border-red-200'              },
  slate:   { dot: 'bg-slate-400',   badge: 'text-slate-600 bg-slate-50 border-slate-200'        },
};

function GrupoRentas({ titulo, color, solicitudes }: {
  titulo:      string;
  color:       ColorGrupo;
  solicitudes: SolicitudRenta[];
}) {
  const [abierto, setAbierto] = useState(true);
  const c = colorMap[color];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <span className="text-sm font-semibold text-slate-800 flex-1">{titulo}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.badge}`}>
          {solicitudes.length}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {abierto && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {solicitudes.map(s => <RentaFilaCompacta key={s.id} solicitud={s} />)}
        </div>
      )}
    </div>
  );
}

// ── GrupoHistorial ────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function GrupoHistorial({ titulo, solicitudes }: {
  titulo:      string;
  solicitudes: SolicitudRenta[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [pagina,  setPagina]  = useState(1);
  const c = colorMap['slate'];

  const visibles = solicitudes.slice(0, pagina * PAGE_SIZE);
  const hayMas   = visibles.length < solicitudes.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <span className="text-sm font-semibold text-slate-800 flex-1">{titulo}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.badge}`}>
          {solicitudes.length}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {abierto && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {visibles.map(s => <RentaFilaCompacta key={s.id} solicitud={s} destacarTotal />)}
          {hayMas && (
            <div className="px-5 py-3 flex justify-center">
              <button
                onClick={() => setPagina(p => p + 1)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Ver más (+{solicitudes.length - visibles.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── RentaFilaCompacta ─────────────────────────────────────────────────────────

const estadoLabels: Record<string, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700'   },
  APROBADA:  { label: 'Aprobada',  cls: 'bg-blue-100 text-blue-700'       },
  ACTIVA:    { label: 'Activa',    cls: 'bg-emerald-100 text-emerald-700' },
  VENCIDA:   { label: 'Vencida',   cls: 'bg-red-100 text-red-700'         },
  DEVUELTA:  { label: 'Devuelta',  cls: 'bg-slate-100 text-slate-600'     },
  RECHAZADA: { label: 'Rechazada', cls: 'bg-rose-100 text-rose-700'       },
};

function equipoLabel(item: ItemSnapshot): string {
  if (item.kind === 'maquinaria' || item.kind === 'pesada') {
    return `${item.descripcion} #${item.numeracion}`;
  }
  return `${item.tipoLabel}${item.cantidad > 1 ? ` ×${item.cantidad}` : ''}`;
}

function RentaChips({ items, maxVisible }: { items: ItemSnapshot[]; maxVisible?: number }) {
  const chips   = items.map(equipoLabel);
  const visible = maxVisible !== undefined ? chips.slice(0, maxVisible) : chips;
  const resto   = maxVisible !== undefined ? Math.max(0, chips.length - maxVisible) : 0;

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
      {visible.map((label, i) => (
        <span key={i} className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
          {label}
        </span>
      ))}
      {resto > 0 && (
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          +{resto} más
        </span>
      )}
    </div>
  );
}

function RentaFilaCompacta({
  solicitud: s,
  mostrarProyecto = false,
  destacarTotal   = false,
}: {
  solicitud:        SolicitudRenta;
  mostrarProyecto?: boolean;
  destacarTotal?:   boolean;
}) {
  const estado = estadoLabels[s.estado] ?? { label: s.estado, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="px-5 py-3 flex flex-wrap items-start gap-x-4 gap-y-1.5">
      {/* Folio + tipo */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-slate-700 font-mono">{s.folio ?? s.id.slice(0, 8)}</span>
        {s.esPesada && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PESADA</span>
        )}
        {mostrarProyecto && <ProyectoBadge proyecto={s.proyecto} />}
      </div>
      {/* chips de equipos */}
      <RentaChips items={s.items ?? []} />
      {/* Estado + fechas + total */}
      <div className="flex items-center gap-3 flex-wrap ml-auto">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado.cls}`}>
          {estado.label}
        </span>
        <span className="text-xs text-slate-400 shrink-0">
          {formatFecha(s.fechaInicioRenta)} → {s.fechaFinEstimada ? formatFecha(s.fechaFinEstimada) : '–'}
        </span>
        {s.totalFinal != null && (
          <span className={`text-xs shrink-0 font-mono ${destacarTotal ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
            Q {s.totalFinal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EstadoVacio({ busqueda }: { busqueda: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
      <svg width="44" height="44" viewBox="0 0 16 16" fill="currentColor" className="text-slate-200">
        <path d="M2 3.5A1.5 1.5 0 013.5 2h2.764c.958 0 1.76.56 2.134 1.373L8.75 4.5H12.5A1.5 1.5 0 0114 6v6.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z"/>
      </svg>
      <p className="text-sm font-medium">
        {busqueda ? 'Sin resultados' : 'Aún no hay proyectos'}
      </p>
      <p className="text-xs text-center max-w-xs leading-relaxed">
        {busqueda
          ? 'Intenta con otro nombre o cambia el filtro.'
          : 'Crea el primero con el botón "Nuevo proyecto".'}
      </p>
    </div>
  );
}
