// RentaModal.tsx — modal de detalle de renta

import type { ToastType } from '../../types/ui.types'

interface RentaData {
  cliente: string
  estado: string
  total: string
  equipos: string
  inicio: string
  duracion: string
  telefono?: string
  dpi?: string
  notas?: string
  solicitadoPor?: string
}

const rentaData: Record<string, RentaData> = {
  'RNT-2024-089': {
    cliente: 'Juan Choc — CLI-0042',
    estado: 'Pendiente',
    total: 'Q 2,900.00',
    equipos: 'Compresor x1 · Martillo x1 · Andamio x2',
    inicio: '19 Feb 2026',
    duracion: '5 días',
    telefono: '5555-1234',
    dpi: '2345 67890 1234',
    notas: 'Cliente solicita entrega en obra, Zona 7, Ciudad de Guatemala.',
    solicitadoPor: 'Juan Pérez — Enc. Máquinas',
  },
  'RNT-2024-087': {
    cliente: 'Carlos Tun — CLI-0031',
    estado: 'Pendiente',
    total: 'Q 1,250.00',
    equipos: 'Cortadora de Concreto x1',
    inicio: '22 Feb 2026',
    duracion: '5 días',
    telefono: '4444-5678',
    dpi: '3456 78901 2345',
    solicitadoPor: 'Juan Pérez — Enc. Máquinas',
  },
  'RNT-2024-088': {
    cliente: 'María González — CLI-0028',
    estado: 'Aprobada',
    total: 'Q 450.00',
    equipos: 'Taladro Industrial x1',
    inicio: '15 Feb 2026',
    duracion: '3 días',
    telefono: '3333-9012',
    dpi: '4567 89012 3456',
    solicitadoPor: 'Ana López — Secretaria',
  },
  'RNT-2024-085': {
    cliente: 'Ferretería El Progreso',
    estado: 'Activa',
    total: 'Q 3,220.00',
    equipos: 'Generador Eléctrico x1 · Sierra Circular x1',
    inicio: '12 Feb 2026',
    duracion: '7 días',
    solicitadoPor: 'Juan Pérez — Enc. Máquinas',
  },
  'RNT-2024-086': {
    cliente: 'Construcciones Ajú',
    estado: 'Activa',
    total: 'Q 2,420.00',
    equipos: 'Andamio Metálico x4 · Mezcladora x1',
    inicio: '19 Feb 2026',
    duracion: '10 días',
    solicitadoPor: 'Juan Pérez — Enc. Máquinas',
  },
  'RNT-2024-081': {
    cliente: 'Roberto Ajú Tum — CLI-0019',
    estado: 'Vencida',
    total: 'Q 1,540.00',
    equipos: 'Mezcladora de Concreto x1',
    inicio: '10 Feb 2026',
    duracion: '7 días',
    telefono: '3333-9012',
    dpi: '4567 89012 3456',
    solicitadoPor: 'Juan Pérez — Enc. Máquinas',
  },
}

const estadoBadge: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Aprobada: 'bg-green-100 text-green-700',
  Activa: 'bg-indigo-100 text-indigo-700',
  Vencida: 'bg-red-100 text-red-700',
  Completada: 'bg-slate-100 text-slate-600',
}

interface RentaModalProps {
  open: boolean
  rentaId: string
  onClose: () => void
  onShowToast: (type: ToastType, title: string, msg: string) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm font-semibold text-slate-500 min-w-[120px] flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 flex-1">{children}</span>
    </div>
  )
}

export default function RentaModal({ open, rentaId, onClose, onShowToast }: RentaModalProps) {
  if (!open) return null

  const data = rentaData[rentaId]
  const esPendiente = data?.estado === 'Pendiente'

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-[580px] max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div>
            <div className="text-base font-bold text-slate-800 font-mono">{rentaId}</div>
            <div className="text-sm text-slate-500 mt-0.5">Detalle de renta</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {data ? (
            <div>
              <Row label="Estado">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${estadoBadge[data.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                  {data.estado}
                </span>
              </Row>
              <Row label="Cliente">
                <span className="font-semibold">{data.cliente}</span>
              </Row>
              {data.telefono && <Row label="Teléfono">{data.telefono}</Row>}
              {data.dpi && (
                <Row label="DPI">
                  <span className="font-mono">{data.dpi}</span>
                </Row>
              )}
              <Row label="Equipos">
                <div className="flex flex-wrap gap-1.5">
                  {data.equipos.split(' · ').map(eq => (
                    <span key={eq} className="text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md">
                      {eq}
                    </span>
                  ))}
                </div>
              </Row>
              <Row label="Fecha inicio">{data.inicio}</Row>
              <Row label="Duración">{data.duracion}</Row>
              <Row label="Total estimado">
                <span className="font-mono font-bold text-lg text-indigo-600">{data.total}</span>
              </Row>
              {data.solicitadoPor && <Row label="Solicitado por">{data.solicitadoPor}</Row>}
              {data.notas && (
                <Row label="Notas">
                  <span className="text-slate-500">{data.notas}</span>
                </Row>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No se encontró información para esta renta.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {esPendiente && (
            <button
              onClick={() => { onShowToast('error', 'Rechazada', `Solicitud ${rentaId} rechazada`); onClose() }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Rechazar
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Cerrar
            </button>
            {esPendiente && (
              <button
                onClick={() => { onShowToast('success', 'Aprobada', `Solicitud ${rentaId} aprobada exitosamente`); onClose() }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Aprobar solicitud
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
