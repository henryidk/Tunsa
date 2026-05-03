import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo, TipoConCategorias } from '../../types/equipo.types';
import type { TipoExtra } from '../../services/equipos.service';
import { equiposService, extrasService } from '../../services/equipos.service';
import PasoIndicador from './equipo-modal/PasoIndicador';
import ExtrasEditor, { type ExtraActivo } from './equipo-modal/ExtrasEditor';

interface Props {
  equipo:  Equipo | null;
  open:    boolean;
  tipos:   TipoConCategorias[];
  onClose: () => void;
  onSave:  (updated: Equipo) => void;
}

interface FormState {
  numeracion:  string;
  descripcion: string;
  tipoId:      string;
  categoriaId: string;
  serie:       string;
  fechaCompra: string;
  montoCompra: string;
  rentaHora:   string;
  rentaDia:    string;
  rentaSemana: string;
  rentaMes:    string;
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
const LABEL_CLS = 'block text-xs font-semibold text-slate-600 mb-1.5';
const SECCION   = 'text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3';

export default function EditarEquipoModal({ equipo, open, tipos, onClose, onSave }: Props) {
  const [paso,            setPaso]            = useState<1 | 2>(1);
  const [form,            setForm]            = useState<FormState>({} as FormState);
  const [extrasActivos,   setExtrasActivos]   = useState<ExtraActivo[]>([]);
  const [tiposExtra,      setTiposExtra]      = useState<TipoExtra[]>([]);
  const [isSaving,        setIsSaving]        = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [confirmarTipo,   setConfirmarTipo]   = useState(false);

  useEffect(() => {
    if (!open || !equipo) return;
    const modalidad = equipo.tipo.modalidad;
    setForm({
      numeracion:  equipo.numeracion,
      descripcion: equipo.descripcion,
      tipoId:      equipo.tipoId,
      categoriaId: equipo.categoriaId ?? '',
      serie:       equipo.serie ?? '',
      fechaCompra: equipo.fechaCompra.substring(0, 10),
      montoCompra: equipo.montoCompra.toString(),
      rentaHora:   modalidad === 'PESADA'  ? (equipo.rentaHora?.toString()   ?? '') : '',
      rentaDia:    modalidad === 'LIVIANA' ? (equipo.rentaDia?.toString()    ?? '') : '',
      rentaSemana: modalidad === 'LIVIANA' ? (equipo.rentaSemana?.toString() ?? '') : '',
      rentaMes:    modalidad === 'LIVIANA' ? (equipo.rentaMes?.toString()    ?? '') : '',
    });
    setExtrasActivos(equipo.extras.map(e => ({
      tipoExtraId: e.tipoExtraId,
      rentaHora:   e.rentaHora.toString(),
    })));
    setError(null);
    setPaso(1);
    extrasService.getAll().then(setTiposExtra).catch(() => {});
  }, [open, equipo]);

  if (!open || !equipo) return null;

  const tipoSeleccionado  = tipos.find(t => t.id === form.tipoId);
  const categoriasDelTipo = tipoSeleccionado?.categorias ?? [];
  const modalidad         = tipoSeleccionado?.modalidad ?? equipo.tipo.modalidad;
  const tipoHaCambiado    = form.tipoId !== equipo.tipoId;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({
        ...prev,
        [field]: e.target.value,
        ...(field === 'tipoId' ? { categoriaId: '' } : {}),
      }));
      setError(null);
    };

  const toggleExtra = (tipoExtraId: string) =>
    setExtrasActivos(prev => prev.find(e => e.tipoExtraId === tipoExtraId)
      ? prev.filter(e => e.tipoExtraId !== tipoExtraId)
      : [...prev, { tipoExtraId, rentaHora: '' }],
    );

  const updateExtraPrice = (tipoExtraId: string, precio: string) =>
    setExtrasActivos(prev => prev.map(e => e.tipoExtraId === tipoExtraId ? { ...e, rentaHora: precio } : e));

  const handleTipoCreado = (nuevo: TipoExtra) =>
    setTiposExtra(prev => [...prev, nuevo]);

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const irPaso2 = () => {
    if (!form.descripcion.trim())  { setError('La descripción es requerida.'); return; }
    if (!form.tipoId)              { setError('El tipo de maquinaria es requerido.'); return; }
    if (!form.fechaCompra)         { setError('La fecha de compra es requerida.'); return; }
    const monto = parseFloat(form.montoCompra);
    if (isNaN(monto) || monto < 0) { setError('El monto de compra debe ser un número válido.'); return; }

    if (tipoHaCambiado) { setConfirmarTipo(true); return; }
    setError(null);
    setPaso(2);
  };

  const confirmarCambioTipo = () => {
    setConfirmarTipo(false);
    setExtrasActivos([]);
    setError(null);
    setPaso(2);
  };

  const handleGuardar = async () => {
    for (const extra of extrasActivos) {
      const precio = parseFloat(extra.rentaHora);
      if (isNaN(precio) || precio < 0) {
        const nombre = tiposExtra.find(t => t.id === extra.tipoExtraId)?.nombre ?? extra.tipoExtraId;
        setError(`El precio del complemento "${nombre}" no es válido.`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};

    const descripcion = form.descripcion.trim();
    if (descripcion !== equipo.descripcion)             payload.descripcion = descripcion;
    if (form.tipoId  !== equipo.tipoId)                 payload.tipoId      = form.tipoId;

    const categoriaId = form.categoriaId || null;
    if (categoriaId !== equipo.categoriaId)             payload.categoriaId = categoriaId;

    const serie = form.serie.trim() || null;
    if (serie !== (equipo.serie ?? null))               payload.serie = serie ?? undefined;
    if (form.fechaCompra !== equipo.fechaCompra.substring(0, 10)) payload.fechaCompra = form.fechaCompra;

    const monto = parseFloat(form.montoCompra);
    if (monto !== equipo.montoCompra)                   payload.montoCompra = monto;

    if (modalidad === 'PESADA') {
      const rentaHora = form.rentaHora ? parseFloat(form.rentaHora) : null;
      if (rentaHora !== equipo.rentaHora)               payload.rentaHora = rentaHora ?? undefined;

      const extrasOriginales = equipo.extras.map(e => ({ tipoExtraId: e.tipoExtraId, rentaHora: e.rentaHora.toString() }));
      const extrasIguales =
        extrasActivos.length === extrasOriginales.length &&
        extrasActivos.every(ea => extrasOriginales.some(eo => eo.tipoExtraId === ea.tipoExtraId && eo.rentaHora === ea.rentaHora));

      if (!extrasIguales) {
        payload.extras = extrasActivos.length > 0
          ? extrasActivos.map(e => ({ tipoExtraId: e.tipoExtraId, rentaHora: parseFloat(e.rentaHora) }))
          : null;
      }
    }

    if (modalidad === 'LIVIANA') {
      const rentaDia    = form.rentaDia    ? parseFloat(form.rentaDia)    : null;
      const rentaSemana = form.rentaSemana ? parseFloat(form.rentaSemana) : null;
      const rentaMes    = form.rentaMes    ? parseFloat(form.rentaMes)    : null;
      if (rentaDia    !== equipo.rentaDia)    payload.rentaDia    = rentaDia    ?? undefined;
      if (rentaSemana !== equipo.rentaSemana) payload.rentaSemana = rentaSemana ?? undefined;
      if (rentaMes    !== equipo.rentaMes)    payload.rentaMes    = rentaMes    ?? undefined;
    }

    if (Object.keys(payload).length === 0) { onClose(); return; }

    try {
      const updated = await equiposService.update(equipo.id, payload);
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg ?? 'Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
        onClick={handleOverlayClick}
      >
        <div className="bg-white rounded-2xl w-full max-w-[580px] shadow-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
            <div>
              <h2 className="font-bold text-slate-800 text-base">Editar equipo</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                #{equipo.numeracion}{equipo.categoria ? ` · ${equipo.categoria.nombre}` : ''}
              </p>
            </div>
            <button onClick={onClose} disabled={isSaving}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <PasoIndicador paso={paso} pasos={['Información', 'Precios']} />

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

            {/* ── Paso 1: Información general ── */}
            {paso === 1 && (
              <>
                <div>
                  <p className={SECCION}>Identificación</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Numeración</label>
                      <div className={`${INPUT_CLS} font-mono bg-slate-50 text-slate-500 cursor-not-allowed select-none`}>
                        {form.numeracion}
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Tipo</label>
                      <select value={form.tipoId} onChange={handleChange('tipoId')} disabled={isSaving}
                        className={`${INPUT_CLS} bg-white`}>
                        {tipos.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={LABEL_CLS}>Categoría</label>
                      <select value={form.categoriaId} onChange={handleChange('categoriaId')}
                        disabled={isSaving || categoriasDelTipo.length === 0}
                        className={`${INPUT_CLS} bg-white`}>
                        <option value="">
                          {categoriasDelTipo.length === 0 ? 'Sin categorías para este tipo' : 'Sin categoría'}
                        </option>
                        {categoriasDelTipo.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={LABEL_CLS}>Descripción del equipo</label>
                      <textarea value={form.descripcion} onChange={handleChange('descripcion')}
                        disabled={isSaving} rows={2} className={`${INPUT_CLS} resize-none`} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className={SECCION}>Serie</p>
                  <label className={LABEL_CLS}>Serie equipo / motor</label>
                  <input type="text" value={form.serie} onChange={handleChange('serie')}
                    disabled={isSaving} className={`${INPUT_CLS} font-mono`} />
                </div>

                <div>
                  <p className={SECCION}>Compra</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Fecha de compra</label>
                      <input type="date" value={form.fechaCompra} onChange={handleChange('fechaCompra')}
                        disabled={isSaving} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Monto de compra (Q)</label>
                      <input type="text" inputMode="decimal" value={form.montoCompra} onChange={handleChange('montoCompra')}
                        disabled={isSaving} className={`${INPUT_CLS} font-mono`} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Paso 2: Precios ── */}
            {paso === 2 && (
              <>
                {modalidad === 'PESADA' && (
                  <>
                    <div>
                      <p className={SECCION}>Tarifa base (Q/hora)</p>
                      <input type="text" inputMode="decimal" value={form.rentaHora} onChange={handleChange('rentaHora')}
                        disabled={isSaving} placeholder="0.00" className={`${INPUT_CLS} font-mono`} />
                    </div>
                    <div>
                      <p className={SECCION}>Complementos</p>
                      <ExtrasEditor
                        tiposExtra={tiposExtra}
                        extrasActivos={extrasActivos}
                        disabled={isSaving}
                        onToggle={toggleExtra}
                        onUpdatePrice={updateExtraPrice}
                        onTipoCreado={handleTipoCreado}
                      />
                    </div>
                  </>
                )}

                {modalidad === 'LIVIANA' && (
                  <div>
                    <p className={SECCION}>Tarifas de renta (Q)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(['rentaDia', 'rentaSemana', 'rentaMes'] as const).map((field, i) => (
                        <div key={field}>
                          <label className={LABEL_CLS}>{['Por día', 'Por semana', 'Por mes'][i]}</label>
                          <input type="text" inputMode="decimal" value={form[field]} onChange={handleChange(field)}
                            disabled={isSaving} placeholder="0.00" className={`${INPUT_CLS} font-mono`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {modalidad === 'USO_PROPIO' && (
                  <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-xs text-slate-500">Los equipos de uso propio no tienen tarifas de renta.</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-xs text-red-600 font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex-shrink-0">
            {paso === 1 ? (
              <button onClick={onClose} disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
                Cancelar
              </button>
            ) : (
              <button onClick={() => { setError(null); setPaso(1); }} disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-40">
                Atrás
              </button>
            )}

            {paso === 1 ? (
              <button onClick={irPaso2} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60">
                Siguiente
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ) : (
              <button onClick={handleGuardar} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {isSaving
                  ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Guardar cambios</>
                }
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Diálogo de confirmación — cambio de tipo */}
      {confirmarTipo && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">¿Cambiar tipo de maquinaria?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Estás moviendo{' '}
                  <span className="font-semibold text-slate-700">#{equipo.numeracion}</span> de{' '}
                  <span className="font-semibold text-slate-700">{equipo.tipo.nombre.replace(/_/g, ' ')}</span> a{' '}
                  <span className="font-semibold text-slate-700">{tipoSeleccionado?.nombre.replace(/_/g, ' ')}</span>.
                  Los precios y complementos actuales se reiniciarán.
                </p>
              </div>
            </div>

            {categoriasDelTipo.length > 0 && (
              <div className={`rounded-xl px-4 py-3 border ${form.categoriaId ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {form.categoriaId ? 'Categoría seleccionada' : 'Este tipo tiene categorías disponibles'}
                </p>
                <select
                  value={form.categoriaId}
                  onChange={handleChange('categoriaId')}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 bg-white text-slate-800"
                >
                  <option value="">Sin categoría</option>
                  {categoriasDelTipo.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmarTipo(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarCambioTipo}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors">
                Sí, cambiar tipo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
