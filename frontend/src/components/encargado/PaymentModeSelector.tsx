import type { ModalidadPago } from '../../types/solicitud.types';

interface Props {
  value:    ModalidadPago | null;
  onChange: (mode: ModalidadPago) => void;
}

interface Option {
  value:       ModalidadPago;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  activeRing:  string;
  activeBg:    string;
  activeLabel: string;
  activeDot:   string;
}

const OPTIONS: Option[] = [
  {
    value:       'CONTADO',
    label:       'Contado',
    description: 'El cliente paga antes de retirar el equipo.',
    activeRing:  'ring-emerald-400',
    activeBg:    'bg-emerald-50 border-emerald-300',
    activeLabel: 'text-emerald-800',
    activeDot:   'bg-emerald-500',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    value:       'CREDITO',
    label:       'A crédito',
    description: 'El cliente paga al devolver el equipo.',
    activeRing:  'ring-amber-400',
    activeBg:    'bg-amber-50 border-amber-300',
    activeLabel: 'text-amber-800',
    activeDot:   'bg-amber-500',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
];

export default function PaymentModeSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(opt => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`
                relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                ${isActive
                  ? `${opt.activeBg} ring-2 ${opt.activeRing}`
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
              `}
            >
              {/* Dot indicator */}
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isActive ? opt.activeDot : 'bg-slate-300'}`} />

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold transition-colors ${isActive ? opt.activeLabel : 'text-slate-700'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                  {opt.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
