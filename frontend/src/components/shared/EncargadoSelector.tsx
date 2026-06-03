interface Props {
  value:      string;
  onChange:   (val: string) => void;
  encargados: { username: string; nombre: string }[];
  disabled?:  boolean;
}

export default function EncargadoSelector({ value, onChange, encargados, disabled = false }: Props) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        Encargado <span className="text-red-400">*</span>
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">— Selecciona un encargado —</option>
        {encargados.map(e => (
          <option key={e.username} value={e.username}>{e.nombre}</option>
        ))}
      </select>
    </div>
  );
}
