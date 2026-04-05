// ClienteSearchWidget.tsx — búsqueda y selección de cliente para formularios
// Carga la lista una sola vez (lazy, al primer foco). Filtrado local.
// Incluye acceso directo al modal de registro formal para clientes nuevos.

import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { clientesService } from '../services/clientes.service';
import type { Cliente } from '../services/clientes.service';
import RegistrarClienteModal from './admin/RegistrarClienteModal';

interface Props {
  onSelect: (cliente: Cliente | null) => void;
}

const MAX_DROPDOWN_RESULTS = 8;

function clienteInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

// ── Estado: cliente ya seleccionado ─────────────────────────────────────────

function ClienteSeleccionado({ cliente, onClear }: { cliente: Cliente; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
        {clienteInitials(cliente.nombre)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{cliente.nombre}</p>
        <p className="text-xs text-slate-500 font-mono">
          {cliente.id}
          {cliente.telefono ? ` · ${cliente.telefono}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        title="Cambiar cliente"
        className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ── Fila dentro del dropdown ─────────────────────────────────────────────────

function ClienteRow({ cliente, onSelect }: { cliente: Cliente; onSelect: (c: Cliente) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(cliente)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
          {clienteInitials(cliente.nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{cliente.nombre}</p>
          <p className="text-xs text-slate-400 font-mono">
            {cliente.id}
            {cliente.telefono ? ` · ${cliente.telefono}` : ''}
          </p>
        </div>
      </button>
    </li>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ClienteSearchWidget({ onSelect }: Props) {
  const [query,         setQuery]         = useState('');
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [fetchError,    setFetchError]    = useState(false);
  const [isOpen,        setIsOpen]        = useState(false);
  const [selected,      setSelected]      = useState<Cliente | null>(null);
  const [registrarOpen, setRegistrarOpen] = useState(false);

  // Refs síncronos para evitar race conditions en fetching
  const loadedRef    = useRef(false);
  const fetchingRef  = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera del widget
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const loadClientes = async () => {
    if (loadedRef.current || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setFetchError(false);
    try {
      const data = await clientesService.getAll();
      setClientes(data);
      loadedRef.current = true;
    } catch {
      setFetchError(true);
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    loadClientes();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const filteredClientes = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes.slice(0, MAX_DROPDOWN_RESULTS);
    return clientes
      .filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.dpi.includes(q)
      )
      .slice(0, MAX_DROPDOWN_RESULTS);
  })();

  const handleSelect = (cliente: Cliente) => {
    setSelected(cliente);
    setIsOpen(false);
    setQuery('');
    onSelect(cliente);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onSelect(null);
  };

  // Cuando se registra un cliente nuevo: se agrega al cache local y se auto-selecciona
  const handleClienteRegistrado = (cliente: Cliente) => {
    setClientes(prev => [cliente, ...prev]);
    handleSelect(cliente);
  };

  const handleOpenRegistrar = () => {
    setIsOpen(false);
    setRegistrarOpen(true);
  };

  // ── Vista: cliente seleccionado ──
  if (selected) {
    return (
      <>
        <ClienteSeleccionado cliente={selected} onClear={handleClear} />
        <RegistrarClienteModal
          open={registrarOpen}
          onClose={() => setRegistrarOpen(false)}
          onSave={handleClienteRegistrado}
        />
      </>
    );
  }

  // ── Vista: buscador con dropdown ──
  return (
    <>
      <div ref={containerRef} className="relative">

        {/* Input de búsqueda */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder="Buscar por nombre o código CLI-XXXX..."
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
          />
          {isLoading && (
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">

            {/* Error al cargar */}
            {fetchError && (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-red-500 mb-2">No se pudo cargar la lista de clientes.</p>
                <button
                  type="button"
                  onClick={() => { loadedRef.current = false; loadClientes(); }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Cargando */}
            {!fetchError && isLoading && (
              <div className="px-4 py-4 text-center text-sm text-slate-400">Cargando clientes...</div>
            )}

            {/* Resultados */}
            {!fetchError && !isLoading && filteredClientes.length > 0 && (
              <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {filteredClientes.map(c => (
                  <ClienteRow key={c.id} cliente={c} onSelect={handleSelect} />
                ))}
              </ul>
            )}

            {/* Sin resultados para la búsqueda actual */}
            {!fetchError && !isLoading && filteredClientes.length === 0 && query.trim() && (
              <div className="px-4 py-3 text-center">
                <p className="text-sm text-slate-500">
                  Sin resultados para <span className="font-semibold">"{query}"</span>
                </p>
              </div>
            )}

            {/* Prompt inicial (sin texto escrito aún) */}
            {!fetchError && !isLoading && filteredClientes.length === 0 && !query.trim() && (
              <div className="px-4 py-3 text-center text-sm text-slate-400">
                Escribe un nombre o código para buscar
              </div>
            )}

            {/* Opción de registro — siempre visible al pie del dropdown */}
            {!fetchError && !isLoading && (
              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleOpenRegistrar}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 transition-colors text-sm font-medium"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  Registrar nuevo cliente
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      <RegistrarClienteModal
        open={registrarOpen}
        onClose={() => setRegistrarOpen(false)}
        onSave={handleClienteRegistrado}
      />
    </>
  );
}
