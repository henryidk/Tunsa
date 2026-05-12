import EspecialBadge from './EspecialBadge';

interface Props {
  nombre:     string;
  esEspecial: boolean;
  textCls?:   string;
  className?: string;
}

export default function ClienteNombre({
  nombre,
  esEspecial,
  textCls   = 'text-sm font-semibold text-slate-800',
  className = 'flex items-center gap-1.5 flex-wrap',
}: Props) {
  return (
    <div className={className}>
      <span className={textCls}>{nombre}</span>
      {esEspecial && <EspecialBadge />}
    </div>
  );
}
