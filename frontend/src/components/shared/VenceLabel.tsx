import { nivelUrgencia, formatTiempoRestante, URGENCIA_BADGE } from '../../utils/renta-tiempo.utils';

interface VenceLabelProps {
  ms:          number;
  fechaInicio: Date;
  ahora:       number;
}

export default function VenceLabel({ ms, fechaInicio, ahora }: VenceLabelProps) {
  const nivel = nivelUrgencia(ms);
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md ${URGENCIA_BADGE[nivel]}`}>
      {formatTiempoRestante(ms, fechaInicio, ahora)}
    </span>
  );
}
