// ClientesSection.tsx — directorio de clientes registrados

import { useState, useEffect, useRef } from 'react';
import { clientesService } from '../../../services/clientes.service';
import type { Cliente } from '../../../services/clientes.service';
import RegistrarClienteModal from '../RegistrarClienteModal';

import type { ToastType } from '../../../pages/admin/AdminDashboard'

interface Props {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

function initiales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function Avatar({ nombre }: { nombre: string }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
      {initiales(nombre)}
    </div>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Modal de subida de documento ────────────────────────────────────────────

interface SubirDocModalProps {
  cliente: Cliente;
  onClose: () => void;
  onUploaded: (clienteId: string) => void;
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

function SubirDocModal({ cliente, onClose, onUploaded, onShowToast }: SubirDocModalProps) {
  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      onShowToast('error', 'Formato inválido', 'Solo se permiten archivos PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      onShowToast('error', 'Archivo muy grande', 'El PDF no puede superar 10 MB.');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await clientesService.uploadDocumento(cliente.id, file);
      onShowToast('success', 'Documento subido', `La documentación de ${cliente.nombre} fue guardada.`);
      onUploaded(cliente.id);
      onClose();
    } catch {
      onShowToast('error', 'Error al subir', 'No se pudo guardar el documento. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Subir documentación</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cliente: <span className="font-medium text-slate-700">{cliente.nombre}</span> · <code className="font-mono bg-slate-100 px-1 rounded">{cliente.id}</code></p>
          </div>
          <button onClick={onClose} disabled={uploading}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer transition-colors
              ${dragging ? 'border-indigo-400 bg-indigo-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
          >
            {file ? (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar</p>
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-sm font-medium text-slate-600">Arrastra el PDF aquí o haz clic</p>
                <p className="text-xs text-slate-400">Solo PDF · Máximo 10 MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleUpload} disabled={!file || uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            )}
            {uploading ? 'Subiendo...' : 'Subir documento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sección principal ────────────────────────────────────────────────────────

export default function ClientesSection({ onShowToast }: Props) {
  const [clientes,    setClientes]    = useState<Cliente[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [viewingDoc,  setViewingDoc]  = useState<string | null>(null);
  const [subirDoc,    setSubirDoc]    = useState<Cliente | null>(null);

  const handleVerDocumento = async (clienteId: string) => {
    setViewingDoc(clienteId);
    try {
      const url = await clientesService.getDocumentoUrl(clienteId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      onShowToast('error', 'Error', 'No se pudo obtener el documento.');
    } finally {
      setViewingDoc(null);
    }
  };

  const handleDocumentoSubido = (clienteId: string) => {
    setClientes(prev => prev.map(c =>
      c.id === clienteId
        ? { ...c, documentoKey: `clientes/${clienteId}/documento.pdf` }
        : c
    ));
  };

  useEffect(() => {
    clientesService.getAll()
      .then(data => setClientes(data))
      .catch(() => setError('No se pudo cargar la lista de clientes.'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtrados = clientes.filter(c => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.dpi.includes(q) ||
      (c.telefono ?? '').includes(q)
    );
  });

  const handleRegistrado = (cliente: Cliente) => {
    setClientes(prev => [cliente, ...prev]);
    onShowToast('success', 'Cliente registrado', `${cliente.nombre} fue registrado con código ${cliente.id}.`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Directorio de clientes registrados en el sistema</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total clientes',    value: clientes.length,  color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'Registrados hoy',
            value: clientes.filter(c => new Date(c.createdAt).toLocaleDateString('es-GT') === new Date().toLocaleDateString('es-GT')).length,
            color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Con teléfono',      value: clientes.filter(c => c.telefono).length, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${s.bg} mb-2`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={s.color}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o DPI..."
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 min-w-[280px]" />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="text-xs text-slate-500 hover:text-slate-700 underline transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Cliente', 'Código', 'DPI', 'Teléfono', 'Documento', 'Registrado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Cargando clientes...</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
              )}
              {!isLoading && !error && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    {search ? 'No se encontraron clientes.' : 'No hay clientes registrados aún.'}
                  </td>
                </tr>
              )}
              {!isLoading && !error && filtrados.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nombre={c.nombre} />
                      <span className="font-semibold text-slate-800">{c.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{c.id}</code>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.dpi}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{c.telefono ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {c.documentoKey ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleVerDocumento(c.id)}
                          disabled={viewingDoc === c.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {viewingDoc === c.id ? (
                            <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          )}
                          Ver Documentación
                        </button>
                        <button
                          onClick={() => setSubirDoc(c)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors"
                          title="Reemplazar documento"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                          Sin documento
                        </span>
                        <button
                          onClick={() => setSubirDoc(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors"
                          title="Subir documentación"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          Subir
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatFecha(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && filtrados.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">
              {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'}
              {search && ` de ${clientes.length} en total`}
            </span>
          </div>
        )}
      </div>

      <RegistrarClienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleRegistrado}
      />

      {subirDoc && (
        <SubirDocModal
          cliente={subirDoc}
          onClose={() => setSubirDoc(null)}
          onUploaded={handleDocumentoSubido}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
