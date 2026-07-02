interface Props {
  checked:              boolean;
  onToggle:             () => void;
  disabled?:            boolean;
  activeDescription:    string;
  inactiveDescription:  string;
}

export default function ClienteEspecialToggle({
  checked, onToggle, disabled, activeDescription, inactiveDescription,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
        checked
          ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <svg
          width="15" height="15" viewBox="0 0 24 24"
          fill={checked ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 ${checked ? 'text-amber-500' : 'text-slate-400'}`}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <div className="text-left">
          <p className={`text-xs font-semibold ${checked ? 'text-amber-800' : 'text-slate-600'}`}>
            Cliente especial
          </p>
          <p className={`text-[10px] ${checked ? 'text-amber-600' : 'text-slate-400'}`}>
            {checked ? activeDescription : inactiveDescription}
          </p>
        </div>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
        checked ? 'bg-amber-400' : 'bg-slate-300'
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`} />
      </div>
    </button>
  );
}
