import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { Equipo, TipoConCategorias } from '../../types/equipo.types';
import type { TipoExtra } from '../../services/equipos.service';
import { equiposService, extrasService } from '../../services/equipos.service';
import PasoIndicador from './equipo-modal/PasoIndicador';
import ExtrasEditor, { type ExtraActivo } from './equipo-modal/ExtrasEditor';

interface Props {
  open:      boolean;
  tipos:     TipoConCategorias[];
  onClose:   () => void;
  onCreated: (nuevo: Equipo) => void;
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

const FORM_VACIO: FormState = {
  numeracion: '', descripcion: '', tipoId: '', categoriaId: '', serie: '',
  fechaCompra: '', montoCompra: '',
  rentaHora: '', rentaDia: '', rentaSemana: '', rentaMes: '',
};

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
const LABEL_CLS = 'block text-xs font-semibold text-slate-600 mb-1.5';
const SECCION   = 'text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3';

export default function AgregarEquipoModal({ open, tipos, onClose, onCreated }: Props) {
  const [paso,          setPaso]          = useState<1 | 2>(1);
  const [form,          setForm]          = useState<FormState>(FORM_VACIO);
  const [extrasActivos, setExtrasActivos] = useState<ExtraActivo[]>([]);
  const [tiposExtra,    setTiposExtra]    = useState<TipoExtra[]>([]);
  const [isSaving,      setIsSaving]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    extrasService.getAll().then(setTiposExtra).catch(() => {});
  }, [open]);

  if (!open) return null;

  const tipoSeleccionado  = tipos.find(t => t.id === form.tipoId);
  const categoriasDelTipo = tipoSeleccionado?.categorias ?? [];
  const modalidad         = tipoSeleccionado?.modalidad;

  const handleChange = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({
        ...prev,
        [field]: e.target.value,
        ...(field === 'tipoId' ? { categoriaId: '', rentaHora: '', rentaDia: '', rentaSemana: '', rentaMes: '' } : {}),
      }));
      if (field === 'tipoId') setExtrasActivos([]);
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

  const handleClose = () => {
    if (isSaving) return;
    setForm(FORM_VACIO);
    setExtrasActivos([]);
    setError(null);
    setPaso(1);
    onClose();
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const validarPaso1 = (): string | null => {
    if (!form.numeracion.trim())                           return 'La numeración es requerida.';
    if (!form.descripcion.trim())                          return 'La descripción es requerida.';
    if (!form.tipoId)                                      return 'El tipo de maquinaria es requerido.';
    if (!form.fechaCompra)                                 return 'La fecha de compra es requerida.';
    const monto = parseFloat(form.montoCompra);
    if (isNaN(monto) || monto < 0)                        return 'El monto de compra debe ser un número válido.';
    return null;
  };

  const irPaso2 = () => {
    const err = validarPaso1();
    if (err) { setError(err); return; }
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
    try {
      const nuevo = await equiposService.create({
        numeracion:  form.numeracion.trim(),
        descripcion: form.descripcion.trim(),
        tipoId:      form.tipoId,
        categoriaId: form.categoriaId || undefined,
        serie:       form.serie.trim() || undefined,
        fechaCompra: form.fechaCompra,
        montoCompra: parseFloat(form.montoCompra),
        ...(modalidad === 'PESADA' ? {
          rentaHora: form.rentaHora ? parseFloat(form.rentaHora) : undefined,
          extras:    extrasActivos.map(e => ({ tipoExtraId: e.tipoExtraId, rentaHora: parseFloat(e.rentaHora) })),
        } : {}),
        ...(modalidad === 'LIVIANA' ? {
          rentaDia:    form.rentaDia    ? parseFloat(form.rentaDia)    : undefined,
          rentaSemana: form.rentaSemana ? parseFloat(form.rentaSemana) : undefined,
          rentaMes:    form.rentaMes    ? parseFloat(form.rentaMes)    : undefined,
        } : {}),
      });
      onCreated(nuevo);
      handleClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Ocurrió un error al crear el equipo.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-[580px] shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Nuevo equipo</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registrar equipo en el inventario</p>
          </div>
          <button onClick={handleClose} disabled={isSaving}
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
                    <label className={LABEL_CLS}>Numeración <span className="text-red-400">*</span></label>
                    <input type="text" value={form.numeracion} onChange={handleChange('numeracion')}
                      disabled={isSaving} placeholder="Ej. 1, 47, MP01"
                      className={`${INPUT_CLS} font-mono`} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Tipo <span className="text-red-400">*</span></label>
                    <select value={form.tipoId} onChange={handleChange('tipoId')} disabled={isSaving}
                      className={`${INPUT_CLS} bg-white`}>
                      <option value="">Seleccionar tipo...</option>
                      {tipos.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Categoría</label>
                    <select value={form.categoriaId} onChange={handleChange('categoriaId')}
                      disabled={isSaving || !form.tipoId || categoriasDelTipo.length === 0}
                      className={`${INPUT_CLS} bg-white`}>
                      <option value="">
                        {!form.tipoId ? 'Selecciona un tipo primero'
                          : categoriasDelTipo.length === 0 ? 'Sin categorías para este tipo'
                          : 'Sin categoría'}
                      </option>
                      {categoriasDelTipo.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Descripción del equipo <span className="text-red-400">*</span></label>
                    <textarea value={form.descripcion} onChange={handleChange('descripcion')}
                      disabled={isSaving} placeholder="Ej. Bailarina Husqvarna con motor Honda GXR120"
                      rows={2} className={`${INPUT_CLS} resize-none`} />
                  </div>
                </div>
              </div>

              <div>
                <p className={SECCION}>Serie</p>
                <label className={LABEL_CLS}>Serie equipo / motor</label>
                <input type="text" value={form.serie} onChange={handleChange('serie')}
                  disabled={isSaving} placeholder="Ej. 20213400041 / GCAAH-5549003"
                  className={`${INPUT_CLS} font-mono`} />
              </div>

              <div>
                <p className={SECCION}>Compra</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Fecha de compra <span className="text-red-400">*</span></label>
                    <input type="date" value={form.fechaCompra} onChange={handleChange('fechaCompra')}
                      disabled={isSaving} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Monto de compra (Q) <span className="text-red-400">*</span></label>
                    <input type="text" inputMode="decimal" value={form.montoCompra} onChange={handleChange('montoCompra')}
                      disabled={isSaving} placeholder="0.00" className={`${INPUT_CLS} font-mono`} />
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

              {!modalidad && (
                <p className="text-xs text-slate-400">Selecciona un tipo en el paso anterior para configurar los precios.</p>
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
            <button onClick={handleClose} disabled={isSaving}
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
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Agregar equipo</>
              }
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
