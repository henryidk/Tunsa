import { useState, useEffect, useMemo } from 'react';
import type { Proyecto, ProyectoSolicitudes, EstadoProyecto } from '../../types/proyecto.types';
import type { SolicitudRenta } from '../../types/solicitud-renta.types';
import { proyectosService } from '../../services/proyectos.service';
import { formatFecha } from '../../utils/format';
import ProyectoFormModal from './ProyectoFormModal';
import ProyectoBadge from './ProyectoBadge';

interface Props {
  onNavTo?: (section: string, state?: Record<string, string>) => void;
}

type Vista = 'lista' | 'detalle';

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProyectosSection({ onNavTo: _onNavTo }: Props) {
  const [vista,               setVista]               = useState<Vista>('lista');
  const [proyectos,           setProyectos]           = useState<Proyecto[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState<string | null>(null);
  const [busqueda,            setBusqueda]            = useState('');
  const [filtroEstado,        setFiltroEstado]        = useState<'' | EstadoProyecto>('');
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<Proyecto | null>(null);
  const [solicitudesProyecto, setSolicitudesProyecto] = useState<ProyectoSolicitudes | null>(null);
  const [loadingDetalle,      setLoadingDetalle]      = useState(false);
  const [modalForm,           setModalForm]           = useState<{ proyecto?: Proyecto } | null>(null);
  const [confirmFinalizar,    setConfirmFinalizar]    = useState<Proyecto | null>(null);
  const [finalizando,         setFinalizando]         = useState(false);
  const [errorFinalizar,      setErrorFinalizar]      = useState<string | null>(null);

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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
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
              className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white text-sm font-medium">
              {(['', 'ACTIVO', 'FINALIZADO'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-2 transition-colors ${filtroEstado === e ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
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
                <div key={i} className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
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
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md ${esActivo ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
      {/* Top bar */}
      <div className={`h-1 w-full ${esActivo ? 'bg-emerald-400' : 'bg-slate-300'}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{proyecto.nombre}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{proyecto.cliente.nombre}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${esActivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {proyecto.estado}
          </span>
        </div>

        {/* Fechas */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Creado {formatFecha(proyecto.createdAt)}</span>
          {proyecto.fechaFin && <><span>·</span><span>Finalizado {formatFecha(proyecto.fechaFin)}</span></>}
        </div>

        {/* Contadores */}
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-600">{proyecto.solicitudesActivas}</span> renta{proyecto.solicitudesActivas !== 1 ? 's' : ''} activa{proyecto.solicitudesActivas !== 1 ? 's' : ''}{' '}
          · <span className="font-medium text-slate-600">{proyecto._count.solicitudes}</span> en total
        </p>

        {/* Acciones */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap">
          <button
            onClick={onVerDetalle}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Ver detalle
          </button>
          <span className="text-slate-200">|</span>
          <button
            onClick={onEditar}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Editar
          </button>
          <span className="text-slate-200">|</span>
          {esActivo ? (
            <button
              onClick={onFinalizar}
              disabled={proyecto.solicitudesActivas > 0}
              title={proyecto.solicitudesActivas > 0 ? 'Hay rentas activas o vencidas' : undefined}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Finalizar
            </button>
          ) : (
            <button
              onClick={onReactivar}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              Reactivar
            </button>
          )}
        </div>
      </div>
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
  const esActivo = proyecto.estado === 'ACTIVO';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver a proyectos
        </button>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{proyecto.nombre}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${esActivo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {proyecto.estado}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{proyecto.cliente.nombre}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Creado {formatFecha(proyecto.createdAt)}</span>
              {proyecto.fechaFin && <><span>·</span><span>Finalizado {formatFecha(proyecto.fechaFin)}</span></>}
            </div>
            {proyecto.descripcion && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{proyecto.descripcion}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            {esActivo ? (
              <button
                onClick={onFinalizar}
                disabled={proyecto.solicitudesActivas > 0}
                title={proyecto.solicitudesActivas > 0 ? 'Hay rentas activas o vencidas' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Finalizar
              </button>
            ) : (
              <button
                onClick={onReactivar}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                Reactivar
              </button>
            )}
          </div>
        </div>
      </div>

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
            <GrupoRentas titulo="Historial" color="slate" solicitudes={solicitudes.devueltas} />
          )}
          {solicitudes.enProceso.length === 0 && solicitudes.activas.length === 0 &&
           solicitudes.vencidas.length === 0 && solicitudes.devueltas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M2 3.5A1.5 1.5 0 013.5 2h2.764c.958 0 1.76.56 2.134 1.373L8.75 4.5H12.5A1.5 1.5 0 0114 6v6.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z"/>
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

// ── GrupoRentas ───────────────────────────────────────────────────────────────

type ColorGrupo = 'amber' | 'emerald' | 'red' | 'slate';

const colorMap: Record<ColorGrupo, { dot: string; badge: string }> = {
  amber:   { dot: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50 border-amber-200'   },
  emerald: { dot: 'bg-emerald-400', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  red:     { dot: 'bg-red-400',     badge: 'text-red-700 bg-red-50 border-red-200'         },
  slate:   { dot: 'bg-slate-400',   badge: 'text-slate-600 bg-slate-50 border-slate-200'   },
};

function GrupoRentas({ titulo, color, solicitudes }: {
  titulo:     string;
  color:      ColorGrupo;
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

// ── RentaFilaCompacta ─────────────────────────────────────────────────────────

const estadoLabels: Record<string, { label: string; cls: string }> = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-yellow-100 text-yellow-700' },
  APROBADA:    { label: 'Aprobada',    cls: 'bg-blue-100 text-blue-700'     },
  ACTIVA:      { label: 'Activa',      cls: 'bg-emerald-100 text-emerald-700' },
  VENCIDA:     { label: 'Vencida',     cls: 'bg-red-100 text-red-700'       },
  DEVUELTA:    { label: 'Devuelta',    cls: 'bg-slate-100 text-slate-600'   },
  RECHAZADA:   { label: 'Rechazada',   cls: 'bg-rose-100 text-rose-700'     },
};

function RentaFilaCompacta({ solicitud: s }: { solicitud: SolicitudRenta }) {
  const estado = estadoLabels[s.estado] ?? { label: s.estado, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-slate-700 font-mono">{s.folio ?? s.id.slice(0, 8)}</span>
        {s.esPesada && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PESADA</span>
        )}
        <ProyectoBadge proyecto={s.proyecto} />
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado.cls}`}>
        {estado.label}
      </span>
      <span className="text-xs text-slate-400 flex-1 min-w-0 truncate">
        {formatFecha(s.fechaInicioRenta)} → {s.fechaFinEstimada ? formatFecha(s.fechaFinEstimada) : '–'}
      </span>
      {s.totalFinal != null && (
        <span className="text-xs font-medium text-slate-600 shrink-0">
          Q {s.totalFinal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
        </span>
      )}
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
