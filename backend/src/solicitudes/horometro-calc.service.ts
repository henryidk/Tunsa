/**
 * Lógica pura de cálculo para maquinaria pesada.
 * Sin acceso a DB — fácilmente testeable de forma aislada.
 *
 * Reglas de negocio:
 *  - El día se compone de 1+ tramos diurnos (con/sin complemento), cada uno con su propia tarifa.
 *  - La noche que sigue al cierre se compone de 1+ tramos nocturnos, mismo concepto — el recargo
 *    nocturno (RECARGO_NOCTURNO) ya viene incluido en la `tarifa` de cada tramo nocturno (lo aplica
 *    quien construye el tramo, no este servicio); aquí ambos grupos se suman de la misma forma.
 *  - Mínimo 5 horas diarias (diurnas + nocturnas combinadas).
 *  - Si total < 5 h, el ajuste se valora siempre a tarifa base (sin complemento).
 */
import { Injectable } from '@nestjs/common';

export const MIN_HORAS_DIA   = 5;
export const RECARGO_NOCTURNO = 100; // Q extra por cada hora nocturna

export interface TramoCosto {
  horas:  number;
  tarifa: number;
}

export interface CostoDiaResult {
  horasDiurnasRaw:        number;  // suma de horas de todos los tramos diurnos
  horasDiurnasFacturadas: number;  // horasDiurnasRaw + ajusteMinimo
  ajusteMinimo:           number;  // horas diurnas añadidas para llegar a 5 h/día (a tarifa base)
  horasNocturnas:         number;  // suma de horas de todos los tramos nocturnos
  costoDiurno:            number;
  costoNocturno:          number;
  costoTotal:             number;
}

@Injectable()
export class HorometroCalcService {
  /**
   * Calcula los costos de un día completo dado:
   *  - tramos          : segmentos diurnos (con/sin complemento), cada uno con sus horas y su tarifa.
   *  - tramosNocturnos : segmentos de la noche que sigue al cierre, mismo formato — su `tarifa` ya
   *                      debe incluir el recargo nocturno (RECARGO_NOCTURNO) si aplica.
   *  - tarifaBase      : Q/hora SIN complemento — usada para el ajuste de mínimo.
   */
  calcularCostoDia(
    tramos:          TramoCosto[],
    tramosNocturnos: TramoCosto[],
    tarifaBase:      number,
  ): CostoDiaResult {
    const horasDiurnasRaw = tramos.reduce((s, t) => s + t.horas, 0);
    const horasNocturnas  = tramosNocturnos.reduce((s, t) => s + t.horas, 0);
    const totalHoras      = horasDiurnasRaw + horasNocturnas;

    let ajusteMinimo           = 0;
    let horasDiurnasFacturadas = horasDiurnasRaw;

    if (totalHoras < MIN_HORAS_DIA) {
      ajusteMinimo           = MIN_HORAS_DIA - totalHoras;
      horasDiurnasFacturadas = horasDiurnasRaw + ajusteMinimo;
    }

    const costoTramos   = tramos.reduce((s, t) => s + t.horas * t.tarifa, 0);
    const costoDiurno   = costoTramos + ajusteMinimo * tarifaBase;
    const costoNocturno = tramosNocturnos.reduce((s, t) => s + t.horas * t.tarifa, 0);
    const costoTotal    = costoDiurno + costoNocturno;

    return {
      horasDiurnasRaw,
      horasDiurnasFacturadas,
      ajusteMinimo,
      horasNocturnas,
      costoDiurno,
      costoNocturno,
      costoTotal,
    };
  }

  /** Diferencia de horómetro entre dos lecturas (siempre ≥ 0). */
  diffHorometro(inicio: number, fin: number): number {
    return Math.max(0, fin - inicio);
  }
}
