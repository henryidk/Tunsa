import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';
import type { LecturaHorometro } from '../../../services/solicitudes.service';

export type BloqueoRazon = 'sin-lecturas' | 'sin-fin5pm';

export type Paso = 1 | 2 | 3 | 4 | 'resultado';

export interface ItemRetorno {
  equipoId:            string;
  numeracion:          string;
  descripcion:         string;
  conMartillo:         boolean;
  tarifaEfectiva:      number;
  horometroDevolucion: string;
  seleccionado:        boolean;
}

export interface CargoRow {
  descripcion: string;
  monto:       number | '';
}

export function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

// Espeja las constantes del backend (horometro-calc.service.ts)
const MIN_HORAS_DIA    = 5;
const RECARGO_NOCTURNO = 100;

/**
 * Aplica el efecto del horómetro de devolución a la última lectura de cada equipo
 * seleccionado, replicando la lógica del backend:
 *  - horasNocturnas = horometroDevolucion − último horometroFin5pm
 *  - si diurnas + nocturnas ≥ 5h → quita el ajuste de mínimo
 *  - si diurnas + nocturnas < 5h → recalcula el ajuste
 * Devuelve una copia del array de lecturas con la última lectura de cada equipo actualizada.
 */
export function estimarLecturasConDevolucion(
  lecturas:      LecturaHorometro[],
  seleccionados: ItemRetorno[],
): LecturaHorometro[] {
  return lecturas.map(lectura => {
    const item = seleccionados.find(s => s.equipoId === lectura.equipoId);
    if (!item?.horometroDevolucion) return lectura;

    const horometroDevolucion = parseFloat(item.horometroDevolucion);
    if (isNaN(horometroDevolucion) || lectura.horometroFin5pm == null) return lectura;

    // Solo modificar la última lectura del equipo
    const esUltima = lecturas
      .filter(l => l.equipoId === lectura.equipoId)
      .every(l => l.fecha <= lectura.fecha);
    if (!esUltima) return lectura;

    const horasNocturnas = Math.max(0, horometroDevolucion - lectura.horometroFin5pm);
    if (horasNocturnas === 0) return lectura;

    const horasDiurnasRaw        = lectura.horometroInicio != null
      ? Math.max(0, lectura.horometroFin5pm - lectura.horometroInicio)
      : 0;
    const totalHoras             = horasDiurnasRaw + horasNocturnas;
    const ajusteMinimo           = totalHoras < MIN_HORAS_DIA ? MIN_HORAS_DIA - totalHoras : 0;
    const horasDiurnasFacturadas = horasDiurnasRaw + ajusteMinimo;
    const costoDiurno            = horasDiurnasFacturadas * item.tarifaEfectiva;
    const costoNocturno          = horasNocturnas * (item.tarifaEfectiva + RECARGO_NOCTURNO);
    const costoTotal             = costoDiurno + costoNocturno;

    return { ...lectura, horasNocturnas, horasDiurnasRaw, horasDiurnasFacturadas, ajusteMinimo, costoDiurno, costoNocturno, costoTotal };
  });
}

/**
 * Determina qué ítems seleccionados no pueden procesarse aún y por qué.
 * Regla: toda devolución requiere al menos una lectura completa (inicio + fin5pm).
 */
export function calcularBloqueos(
  lecturas:      LecturaHorometro[],
  seleccionados: ItemRetorno[],
): Map<string, BloqueoRazon> {
  const lecturasPorEquipo = new Map<string, LecturaHorometro[]>();
  for (const l of lecturas) {
    const arr = lecturasPorEquipo.get(l.equipoId) ?? [];
    arr.push(l);
    lecturasPorEquipo.set(l.equipoId, arr);
  }

  const resultado = new Map<string, BloqueoRazon>();
  for (const it of seleccionados) {
    const lects = lecturasPorEquipo.get(it.equipoId) ?? [];
    if (lects.length === 0) {
      resultado.set(it.equipoId, 'sin-lecturas');
    } else {
      const ultima = lects.reduce((a, b) => (a.fecha >= b.fecha ? a : b));
      if (ultima.horometroFin5pm == null) resultado.set(it.equipoId, 'sin-fin5pm');
    }
  }
  return resultado;
}

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

export function getPendientes(solicitud: SolicitudRenta): PesadaItem[] {
  const devueltos = new Set(
    (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
  );
  return (solicitud.items as ItemSnapshot[])
    .filter((i): i is PesadaItem => i.kind === 'pesada' && !devueltos.has(i.equipoId));
}
