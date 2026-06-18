/**
 * Lógica pura de cálculo para maquinaria pesada.
 * Sin acceso a DB — fácilmente testeable de forma aislada.
 *
 * Reglas de negocio:
 *  - El día se compone de 1+ tramos (con/sin complemento), cada uno con su propia tarifa.
 *  - Mínimo 5 horas diarias (diurnas + nocturnas combinadas).
 *  - Si total < 5 h, el ajuste se valora siempre a tarifa base (sin complemento).
 *  - Horas nocturnas = tarifa_nocturna_base + Q100 por hora. La tarifa nocturna base
 *    refleja el complemento con el que cerró el día anterior (puede ser distinto de la base).
 */
import { Injectable } from '@nestjs/common';

export const MIN_HORAS_DIA   = 5;
export const RECARGO_NOCTURNO = 100; // Q extra por cada hora nocturna

export interface TramoCosto {
  horas:  number;
  tarifa: number;
}

export interface CostoDiaResult {
  horasDiurnasRaw:        number;  // suma de horas de todos los tramos
  horasDiurnasFacturadas: number;  // horasDiurnasRaw + ajusteMinimo
  ajusteMinimo:           number;  // horas diurnas añadidas para llegar a 5 h/día (a tarifa base)
  horasNocturnas:         number;
  costoDiurno:            number;
  costoNocturno:          number;
  costoTotal:             number;
}

@Injectable()
export class HorometroCalcService {
  /**
   * Calcula los costos de un día completo dado:
   *  - tramos             : segmentos del día (con/sin complemento), cada uno con sus horas y su tarifa.
   *  - horasNocturnas     : lectura inicio día siguiente − lectura 5PM (0 si no aplica).
   *  - tarifaBase         : Q/hora SIN complemento — usada para el ajuste de mínimo.
   *  - tarifaNocturnaBase : Q/hora base a usar para las horas nocturnas (antes de sumar el recargo).
   *                         Resuelve el complemento que estaba activo cuando cerró el día (puede ser
   *                         distinto de tarifaBase si la máquina se quedó de noche con el complemento puesto).
   *                         Por defecto = tarifaBase (sin complemento), correcto cuando horasNocturnas = 0.
   */
  calcularCostoDia(
    tramos:             TramoCosto[],
    horasNocturnas:     number,
    tarifaBase:         number,
    tarifaNocturnaBase: number = tarifaBase,
  ): CostoDiaResult {
    const horasDiurnasRaw = tramos.reduce((s, t) => s + t.horas, 0);
    const totalHoras      = horasDiurnasRaw + horasNocturnas;

    let ajusteMinimo           = 0;
    let horasDiurnasFacturadas = horasDiurnasRaw;

    if (totalHoras < MIN_HORAS_DIA) {
      ajusteMinimo           = MIN_HORAS_DIA - totalHoras;
      horasDiurnasFacturadas = horasDiurnasRaw + ajusteMinimo;
    }

    const costoTramos   = tramos.reduce((s, t) => s + t.horas * t.tarifa, 0);
    const costoDiurno   = costoTramos + ajusteMinimo * tarifaBase;
    const costoNocturno = horasNocturnas * (tarifaNocturnaBase + RECARGO_NOCTURNO);
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
