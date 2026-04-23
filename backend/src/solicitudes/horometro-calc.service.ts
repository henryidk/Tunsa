/**
 * Lógica pura de cálculo para maquinaria pesada.
 * Sin acceso a DB — fácilmente testeable de forma aislada.
 *
 * Reglas de negocio:
 *  - Mínimo 5 horas diarias (diurnas + nocturnas combinadas).
 *  - Si total < 5 h, se ajusta con horas diurnas adicionales.
 *  - Horas nocturnas = tarifa_base + Q100 por hora.
 *  - Los ajustes siempre se aplican a tarifa diurna.
 */
import { Injectable } from '@nestjs/common';

export const MIN_HORAS_DIA   = 5;
export const RECARGO_NOCTURNO = 100; // Q extra por cada hora nocturna

export interface CostoDiaResult {
  horasDiurnasRaw:        number;  // horometroFin5pm − horometroInicio
  horasDiurnasFacturadas: number;  // horasDiurnasRaw + ajusteMinimo
  ajusteMinimo:           number;  // horas diurnas añadidas para llegar a 5 h/día
  horasNocturnas:         number;
  costoDiurno:            number;
  costoNocturno:          number;
  costoTotal:             number;
}

@Injectable()
export class HorometroCalcService {
  /**
   * Calcula los costos de un día completo dado:
   *  - horasDiurnasRaw  : lectura 5PM − lectura inicio
   *  - horasNocturnas   : lectura inicio día siguiente − lectura 5PM (0 si no aplica)
   *  - tarifaEfectiva   : Q/hora (ya considera martillo o tarifa base)
   */
  calcularCostoDia(
    horasDiurnasRaw: number,
    horasNocturnas:  number,
    tarifaEfectiva:  number,
  ): CostoDiaResult {
    const totalHoras = horasDiurnasRaw + horasNocturnas;

    let ajusteMinimo         = 0;
    let horasDiurnasFacturadas = horasDiurnasRaw;

    if (totalHoras < MIN_HORAS_DIA) {
      ajusteMinimo           = MIN_HORAS_DIA - totalHoras;
      horasDiurnasFacturadas = horasDiurnasRaw + ajusteMinimo;
    }

    const costoDiurno  = horasDiurnasFacturadas * tarifaEfectiva;
    const costoNocturno = horasNocturnas * (tarifaEfectiva + RECARGO_NOCTURNO);
    const costoTotal   = costoDiurno + costoNocturno;

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
