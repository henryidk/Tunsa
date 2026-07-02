import { useState, useRef } from 'react';
import { clientesService } from '../../services/clientes.service';
import type { Cliente } from '../../services/clientes.service';
import type { ToastType } from '../../types/ui.types';

interface SubirDocModalProps {
  cliente: Cliente;
  onClose: () => void;
  onUploaded: (clienteId: string) => void;
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

export default function SubirDocModal({ cliente, onClose, onUploaded, onShowToast }: SubirDocModalProps) {
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
            <p className="text-xs text-slate-500 mt-0.5">
              Cliente: <span className="font-medium text-slate-700">{cliente.nombre}</span>
              {' · '}
              <code className="font-mono bg-slate-100 px-1 rounded">{cliente.id}</code>
            </p>
          </div>
          <button onClick={onClose} disabled={uploading}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer transition-colors ${
              dragging ? 'border-brand-400 bg-brand-50'
              : file   ? 'border-emerald-400 bg-emerald-50'
                       : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
            }`}
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
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
