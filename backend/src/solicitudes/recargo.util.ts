import { fechaGT } from '../common/utils/date.util';

/**
 * Cálculo de recargo por atraso en devolución.
 *
 * Reglas de negocio:
 *  - El cliente tiene 1 hora de gracia después del vencimiento para devolver sin cargo.
 *  - Pasada la gracia, se cobra 1 día adicional por equipo por cada fracción de 24 h de atraso.
 *  - Aplica a todos los ítems de la renta individualmente.
 *
 * Extensiones:
 *  - Las extensiones se acumulan en el campo `extensiones` de la solicitud.
 *  - La fecha de vencimiento efectiva de cada ítem suma la duración original más todas sus extensiones.
 *  - El recargo se calcula contra la fecha de vencimiento efectiva.
 */

/** Milisegundos de gracia antes de que empiece a correr el cargo adicional. */
export const GRACE_MS = 3_600_000; // 1 hora

// ── Tipos de devolución ───────────────────────────────────────────────────────

/** Cargo manual ingresado por el encargado (daños, faltantes, etc.). */
export interface CargoAdicional {
  descripcion: string;
  monto:       number;
}

/** Descuento aplicado por el admin/secretaria a un lote de devolución. */
export interface DescuentoAplicado {
  tipo:          'porcentaje' | 'monto_fijo';
  valor:         number;
  montoOriginal: number;
  montoFinal:    number;
}

/** Detalle de facturación de un ítem individual dentro de una devolución. */
export interface DevolucionItemEntry {
  itemRef:       string;
  kind:          'maquinaria' | 'granel';
  diasCobrados:  number;
  costoReal:     number;   // costo adaptativo sobre días reales usados
  recargoTiempo: number;   // cargo por atraso (0 si a tiempo)
  desglose?:     { meses: number; semanas: number; dias: number }; // solo para rentas indefinidas
  tarifas?:      { dia: number | null; semana: number | null; mes: number | null }; // solo para rentas indefinidas
}

/**
 * Registro de un evento de devolución (parcial o completa).
 * Múltiples entradas posibles en una misma solicitud si se devuelven ítems en lotes.
 */
export interface DevolucionEntry {
  fechaDevolucion:     string;                  // ISO timestamp
  registradoPor:       string;                  // username del encargado
  esParcial:           boolean;
  tipoDevolucion:      'A_TIEMPO' | 'TARDIA';
  items:               DevolucionItemEntry[];
  recargosAdicionales: CargoAdicional[];
  descuento?:          DescuentoAplicado;
  totalLote:           number;                  // monto final a cobrar (después de descuento si aplica)
  liquidacionKey:      string | null;           // R2 key del PDF de liquidación
  detalleHorometroKey?: string | null;          // R2 key del PDF de detalle de uso de horómetro (solo pesada)
}

/** Representa una extensión aplicada a un ítem de la renta. */
export interface ExtensionEntry {
  /** equipoId para ítems de maquinaria; tipo (PUNTAL, ANDAMIO_SIMPLE…) para granel. */
  itemRef:        string;
  kind:           'maquinaria' | 'granel' | 'pesada';
  duracion:       number;
  unidad:         string;
  costoExtra:     number;
  tipo:           'gracia' | 'ampliacion';
  fechaExtension: string; // ISO timestamp
}

// ── Helpers básicos ───────────────────────────────────────────────────────────

/** Calcula la fecha de vencimiento de un ítem a partir del inicio de la renta. */
export function calcularFinItem(
  fechaInicio: Date,
  duracion:    number,
  unidad:      string,
): Date {
  if (unidad === 'horas')   return new Date(fechaInicio.getTime() + duracion * 3_600_000);
  if (unidad === 'dias')    return new Date(fechaInicio.getTime() + duracion * 86_400_000);
  if (unidad === 'semanas') return new Date(fechaInicio.getTime() + duracion * 7 * 86_400_000);
  // meses: calendario real — 29/X + 1 mes = 29/(X+1), clampeado al último día si el mes es más corto
  const tgtMonth  = fechaInicio.getUTCMonth() + duracion;
  const tgtYear   = fechaInicio.getUTCFullYear() + Math.floor(tgtMonth / 12);
  const normMonth = ((tgtMonth % 12) + 12) % 12;
  const lastDay   = new Date(Date.UTC(tgtYear, normMonth + 1, 0)).getUTCDate();
  const tgtDay    = Math.min(fechaInicio.getUTCDate(), lastDay);
  return new Date(Date.UTC(tgtYear, normMonth, tgtDay,
    fechaInicio.getUTCHours(), fechaInicio.getUTCMinutes(), fechaInicio.getUTCSeconds(), fechaInicio.getUTCMilliseconds()));
}

/**
 * Calcula la fecha de vencimiento más temprana entre todos los ítems.
 * Este valor se guarda en `fechaFinEstimada` al confirmar la entrega.
 */
export function calcularFechaFinEstimada(
  fechaInicio: Date,
  items:       Array<{ duracion: number; unidad: string }>,
): Date {
  const fins = items.map(i => calcularFinItem(fechaInicio, i.duracion, i.unidad).getTime());
  return new Date(Math.min(...fins));
}

/**
 * Recargo por atraso para clientes especiales con renta de plazo definido.
 * No se cobra si devuelven el mismo día calendario del vencimiento (sin importar la hora).
 * Si superan ese día, se cobra tarifa × días excedidos.
 */
export function calcularRecargoEspecial(
  tarifa:           number,
  fechaVencimiento: Date,
  fechaDevolucion:  Date,
): number {
  const [vY, vM, vD] = fechaGT(fechaVencimiento).split('-').map(Number);
  const [dY, dM, dD] = fechaGT(fechaDevolucion).split('-').map(Number);
  const diasExcedidos = Math.round(
    (Date.UTC(dY, dM - 1, dD) - Date.UTC(vY, vM - 1, vD)) / 86_400_000,
  );
  if (diasExcedidos <= 0) return 0;
  return diasExcedidos * tarifa;
}

/**
 * Calcula el recargo de un ítem individual dado el momento real de devolución.
 * Devuelve 0 si la devolución ocurre dentro de la hora de gracia.
 */
export function calcularRecargoItem(
  tarifa:           number,
  fechaVencimiento: Date,
  fechaDevolucion:  Date,
): number {
  const excesoMs = fechaDevolucion.getTime() - fechaVencimiento.getTime() - GRACE_MS;
  if (excesoMs <= 0) return 0;
  return Math.ceil(excesoMs / 86_400_000) * tarifa;
}

/**
 * Calcula el recargo total sumando el de cada ítem.
 * Los ítems sin tarifa (null) no generan recargo.
 */
export function calcularRecargoTotal(
  items:           Array<{ duracion: number; unidad: string; tarifa: number | null }>,
  fechaInicio:     Date,
  fechaDevolucion: Date,
): number {
  return items.reduce((suma, item) => {
    if (item.tarifa === null) return suma;
    const fin = calcularFinItem(fechaInicio, item.duracion, item.unidad);
    return suma + calcularRecargoItem(item.tarifa, fin, fechaDevolucion);
  }, 0);
}

// ── Helpers para extensiones ──────────────────────────────────────────────────

/**
 * Descompone un número de días en meses calendario + semanas + días sueltos.
 * Usa la misma lógica que el frontend para mantener consistencia en el precio adaptativo.
 */
export function descomponerDias(
  fechaInicio:   Date,
  totalDias:     number,
): { meses: number; semanas: number; dias: number } {
  let meses = 0;
  let cursor = new Date(fechaInicio);
  let diasRestantes = totalDias;

  while (diasRestantes > 0) {
    const siguiente = new Date(cursor);
    siguiente.setMonth(siguiente.getMonth() + 1);
    const diasEnMes = Math.round((siguiente.getTime() - cursor.getTime()) / 86_400_000);
    if (diasRestantes >= diasEnMes) {
      meses++;
      diasRestantes -= diasEnMes;
      cursor = siguiente;
    } else {
      break;
    }
  }

  return { meses, semanas: Math.floor(diasRestantes / 7), dias: diasRestantes % 7 };
}

/**
 * Descompone el período entre dos fechas en meses calendario, semanas y días sueltos.
 * Opera directamente sobre fechas GT (sin convertir a días intermedios) para que
 * "1 mes" sea siempre un mes de calendario real: enero 31 → febrero 28 = 1 mes,
 * abril 29 → mayo 29 = 1 mes, etc.
 * Usar para rentas indefinidas en lugar de descomponerDias.
 */
export function descomponerCalendario(
  fechaInicio:     Date,
  fechaDevolucion: Date,
): { meses: number; semanas: number; dias: number; diasCobrados: number } {
  const [iY, iM, iD] = fechaGT(fechaInicio).split('-').map(Number);
  const [eY, eM, eD] = fechaGT(fechaDevolucion).split('-').map(Number);

  let curY = iY, curM = iM, curD = iD; // month 1-indexed
  let meses = 0;

  while (true) {
    let nextM = curM + 1;
    let nextY = curY;
    if (nextM > 12) { nextM = 1; nextY++; }

    // Clamp day to last valid day of next month (e.g. Jan 31 → Feb 28)
    const daysInNext = new Date(Date.UTC(nextY, nextM - 1 + 1, 0)).getUTCDate();
    const nextD = Math.min(curD, daysInNext);

    if (Date.UTC(nextY, nextM - 1, nextD) > Date.UTC(eY, eM - 1, eD)) break;

    meses++;
    curY = nextY;
    curM = nextM;
    curD = nextD;
  }

  const cursorTs     = Date.UTC(curY, curM - 1, curD);
  const endTs        = Date.UTC(eY,   eM - 1,   eD);
  const inicioTs     = Date.UTC(iY,   iM - 1,   iD);
  const diasRestantes = Math.round((endTs - cursorTs) / 86_400_000);
  const diasCobrados  = Math.max(Math.round((endTs - inicioTs) / 86_400_000), 1);

  return {
    meses,
    semanas: Math.floor(diasRestantes / 7),
    dias:    diasRestantes % 7,
    diasCobrados,
  };
}

/**
 * Calcula el costo adaptativo de una extensión con las tarifas actuales del equipo.
 * Misma lógica que `calcSubtotal` del frontend: dias → descomponer en meses/semanas/días.
 */
export function calcularCostoAdaptativo(
  fechaInicioExtension: Date,
  duracion:             number,
  unidad:               string,
  precios: {
    dia:    number | null;
    semana: number | null;
    mes:    number | null;
  },
  cantidad = 1,
): number {
  // Tiempo de gracia: extensión en horas, sin costo adicional
  if (unidad === 'horas') return 0;

  if (unidad === 'meses') {
    return (precios.mes ?? 0) * duracion * cantidad;
  }

  const totalDias = unidad === 'semanas' ? duracion * 7 : duracion;
  const { meses, semanas, dias } = descomponerDias(fechaInicioExtension, totalDias);

  return (
    (precios.mes    ?? 0) * meses   +
    (precios.semana ?? 0) * semanas +
    (precios.dia    ?? 0) * dias
  ) * cantidad;
}

/**
 * Calcula la fecha de vencimiento efectiva de un ítem, apilando todas sus extensiones.
 * Las extensiones se aplican en orden cronológico desde el fin original.
 */
export function calcularFinItemConExtensiones(
  fechaInicio:  Date,
  item:         { duracion: number; unidad: string },
  extensiones:  ExtensionEntry[],
): Date {
  let fin = calcularFinItem(fechaInicio, item.duracion, item.unidad);

  for (const ext of extensiones) {
    fin = calcularFinItem(fin, ext.duracion, ext.unidad);
  }

  return fin;
}

/**
 * Calcula la fecha de vencimiento efectiva más temprana entre todos los ítems,
 * considerando las extensiones acumuladas.
 */
export function calcularFechaFinEstimadaConExtensiones(
  fechaInicio:  Date,
  items:        Array<{ duracion: number; unidad: string; equipoId?: string; tipo?: string }>,
  extensiones:  ExtensionEntry[],
): Date {
  const fins = items.map(item => {
    const itemRef = item.equipoId ?? item.tipo ?? '';
    const extsItem = extensiones.filter(e => e.itemRef === itemRef);
    return calcularFinItemConExtensiones(fechaInicio, item, extsItem).getTime();
  });
  return new Date(Math.min(...fins));
}

/**
 * Calcula el recargo total con extensiones — usa la fecha de vencimiento efectiva
 * (original + todas las extensiones del ítem) como base para el cálculo de atraso.
 */
export function calcularRecargoTotalConExtensiones(
  items:           Array<{ duracion: number; unidad: string; tarifa: number | null; equipoId?: string; tipo?: string }>,
  fechaInicio:     Date,
  fechaDevolucion: Date,
  extensiones:     ExtensionEntry[],
): number {
  return items.reduce((suma, item) => {
    if (item.tarifa === null) return suma;
    const itemRef   = item.equipoId ?? item.tipo ?? '';
    const extsItem  = extensiones.filter(e => e.itemRef === itemRef);
    const finEfectivo = calcularFinItemConExtensiones(fechaInicio, item, extsItem);
    return suma + calcularRecargoItem(item.tarifa, finEfectivo, fechaDevolucion);
  }, 0);
}

// ── Facturación de devolución anticipada ──────────────────────────────────────

/**
 * Calcula los días cobrados y el costo real para un ítem devuelto.
 *
 * Reglas:
 *  - Se cuentan los días completos transcurridos desde `fechaInicio`.
 *  - Si el exceso del último día está dentro de la hora de gracia, no se cobra ese día.
 *  - Si supera la gracia, se cobra un día adicional.
 *  - Mínimo 1 día cobrado (siempre se cobra al menos el primer día de renta).
 *  - El costo es adaptativo: se descompone en meses + semanas + días usando los
 *    precios actuales del equipo, igual que en la creación de la solicitud.
 */
export function calcularDevolucionItem(
  fechaInicio:     Date,
  fechaDevolucion: Date,
  precios: { dia: number | null; semana: number | null; mes: number | null },
  cantidad = 1,
): { diasCobrados: number; costoReal: number; desglose: { meses: number; semanas: number; dias: number } } {
  const rentedMs      = fechaDevolucion.getTime() - fechaInicio.getTime();
  const diasCompletos = Math.floor(rentedMs / 86_400_000);
  const excesoMs      = rentedMs - diasCompletos * 86_400_000;

  const diasBase     = excesoMs <= GRACE_MS ? diasCompletos : diasCompletos + 1;
  const diasCobrados = Math.max(diasBase, 1); // siempre se cobra al menos 1 día

  const desglose  = descomponerDias(fechaInicio, diasCobrados);
  const { meses, semanas, dias } = desglose;
  const costoReal = (
    (precios.mes    ?? 0) * meses   +
    (precios.semana ?? 0) * semanas +
    (precios.dia    ?? 0) * dias
  ) * cantidad;

  return { diasCobrados, costoReal, desglose };
}

/**
 * Días calendario entre dos fechas en zona horaria de Guatemala.
 * Mínimo 1 día (siempre se cobra el día de inicio).
 */
export function calcularDiasCalendario(fechaInicio: Date, fechaDevolucion: Date): number {
  const [yA, mA, dA] = fechaGT(fechaInicio).split('-').map(Number)  as [number, number, number];
  const [yB, mB, dB] = fechaGT(fechaDevolucion).split('-').map(Number) as [number, number, number];
  const msInicio = Date.UTC(yA, mA - 1, dA);
  const msFin    = Date.UTC(yB, mB - 1, dB);
  return Math.max(Math.round((msFin - msInicio) / 86_400_000), 1);
}

/**
 * Costos de devolución para rentas indefinidas (clientes especiales sin duración pactada).
 *  - costoReal    = días calendario × tarifa × cantidad
 *  - recargoTiempo siempre 0 (clientes especiales no tienen recargo por atraso)
 */
export function calcularCostosItemIndefinido(
  fechaInicio:     Date,
  fechaDevolucion: Date,
  tarifa:          number,
  cantidad =       1,
): { diasCobrados: number; costoReal: number; recargoTiempo: 0 } {
  const diasCobrados = calcularDiasCalendario(fechaInicio, fechaDevolucion);
  const costoReal    = diasCobrados * tarifa * cantidad;
  return { diasCobrados, costoReal, recargoTiempo: 0 };
}
