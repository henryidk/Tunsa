// ClientesSection.tsx — directorio de clientes registrados

import { useState, useEffect } from 'react';
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

export default function ClientesSection({ onShowToast }: Props) {
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);

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
                {['Cliente', 'Código', 'DPI', 'Teléfono', 'Registrado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">Cargando clientes...</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
              )}
              {!isLoading && !error && filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
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
    </div>
  );
}
