import type { LecturaHorometro } from '../../services/solicitudes.service';
import { today, getDiaStatus, DIA_BG, DIA_ICON, type DiaStatus } from '../../utils/horometro.utils';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  año:              number;
  mes:              number;      // 0-indexed
  lecturas:         LecturaHorometro[];
  fechaInicioRenta: string;     // 'YYYY-MM-DD'
  limiteRegistro:   string;     // último día con lectura requerida — de ultimoDiaHorometro()
  fechaActiva:      string;
  onSelectDia:      (fecha: string) => void;
}

export default function CalendarioMes({
  año, mes, lecturas, fechaInicioRenta, limiteRegistro, fechaActiva, onSelectDia,
}: Props) {
  const hoy = today();

  // First weekday of the month (Mon=0 … Sun=6)
  let offset = new Date(año, mes, 1).getDay() - 1;
  if (offset < 0) offset = 6;

  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= diasEnMes; d++) {
    const mm = String(mes + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${año}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((fecha, i) => {
          if (!fecha) return <div key={`e-${i}`} />;

          const esFueraDeRango = fecha > limiteRegistro;
          const esAntesRenta   = fecha < fechaInicioRenta;
          const disabled       = esFueraDeRango || esAntesRenta;
          const status: DiaStatus | null = disabled ? null : getDiaStatus(lecturas, fecha);
          const esHoy        = fecha === hoy;
          const esActiva     = fecha === fechaActiva;

          return (
            <button
              key={fecha}
              disabled={disabled}
              onClick={() => !disabled && onSelectDia(fecha)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-medium transition-all
                ${disabled
                  ? 'text-slate-200 cursor-default'
                  : `${DIA_BG[status!]} border cursor-pointer`}
                ${esActiva && !disabled ? 'ring-2 ring-indigo-500 ring-offset-1 z-10' : ''}
                ${esHoy && !disabled ? 'font-extrabold' : ''}`}
            >
              <span>{fecha.substring(8)}</span>
              {!disabled && (
                <span className="text-[8px] leading-none mt-0.5">{DIA_ICON[status!]}</span>
              )}
              {esHoy && !disabled && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {(['completo', 'parcial', 'sin-registro'] as DiaStatus[]).map(s => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded border text-[9px] font-bold ${DIA_BG[s]}`}>
              {DIA_ICON[s]}
            </span>
            {s === 'completo' ? 'Completo' : s === 'parcial' ? 'Solo inicio' : 'Sin registro'}
          </span>
        ))}
      </div>
    </div>
  );
}
