import type { Equipo } from './equipo.types';
import type { TipoGranel, ConfigGranel } from '../services/granel.service';

export type UnidadDuracion  = 'horas' | 'dias' | 'semanas' | 'meses';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';

// ── Precios adaptativos ───────────────────────────────────────────────────────

export interface Desglose {
  meses:   number;
  semanas: number;
  dias:    number;
}

/**
 * Descompone una duración en meses calendario + semanas + días sueltos.
 *
 * Reglas:
 *  - Si la unidad ya es 'meses', devuelve { meses: duracion, semanas: 0, dias: 0 }.
 *  - Para 'semanas' o 'dias', convierte a días totales y luego aplica greedy:
 *      1. Consume meses calendario reales (basado en fechaInicio).
 *      2. Divide el resto en semanas completas + días sueltos.
 *
 * Ejemplo (inicio 16/04, 5 semanas = 35 días):
 *   16/04 → 16/05 = 30 días  →  consume 1 mes, restan 5 días
 *   5 días → 0 semanas + 5 días
 *   Resultado: { meses: 1, semanas: 0, dias: 5 }
 */
export function descomponerDuracion(
  fechaInicio: string,
  duracion:    number,
  unidad:      UnidadDuracion,
): Desglose {
  if (unidad === 'horas')  return { meses: 0, semanas: 0, dias: 0 };
  if (unidad === 'meses') return { meses: duracion, semanas: 0, dias: 0 };

  const totalDias = unidad === 'semanas' ? duracion * 7 : duracion;

  let meses = 0;
  let cursor = new Date(fechaInicio + 'T00:00:00');
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

  return {
    meses,
    semanas: Math.floor(diasRestantes / 7),
    dias:    diasRestantes % 7,
  };
}

/** Formatea un desglose como "1 mes + 2 semanas + 3 días". */
export function formatDesglose(d: Desglose): string {
  const parts: string[] = [];
  if (d.meses   > 0) parts.push(`${d.meses} ${d.meses   === 1 ? 'mes'    : 'meses'  }`);
  if (d.semanas > 0) parts.push(`${d.semanas} ${d.semanas === 1 ? 'semana' : 'semanas'}`);
  if (d.dias    > 0) parts.push(`${d.dias} ${d.dias    === 1 ? 'día'    : 'días'   }`);
  return parts.join(' + ') || '0 días';
}

/**
 * Devuelve true si la duración genera un desglose adaptado
 * (es decir, algún componente se cobra en una unidad mayor a la ingresada).
 */
export function esAdaptado(unidad: UnidadDuracion, decomp: Desglose): boolean {
  if (unidad === 'horas')   return false;
  if (unidad === 'meses')   return false;
  if (unidad === 'semanas') return decomp.meses   > 0;
  /* dias */                return decomp.semanas > 0 || decomp.meses > 0;
}

/** Calcula el subtotal de un desglose dadas las tres tarifas. */
function subtotalDescompuesto(
  decomp:  Desglose,
  tarifas: { dia: number | null; semana: number | null; mes: number | null },
): number {
  return (
    (tarifas.mes    ?? 0) * decomp.meses +
    (tarifas.semana ?? 0) * decomp.semanas +
    (tarifas.dia    ?? 0) * decomp.dias
  );
}

export interface ItemMaquinaria {
  kind:        'maquinaria';
  equipo:      Equipo;
  fechaInicio: string;
  duracion:    number;
  unidad:      UnidadDuracion;
}

export interface ItemGranel {
  kind:        'granel';
  tipo:        TipoGranel;
  tipoLabel:   string;
  cantidad:    number;
  fechaInicio: string;
  duracion:    number;
  unidad:      UnidadDuracion;
  config:      ConfigGranel | null;
  /** Solo aplica a ANDAMIO_SIMPLE: indica si se rentan con madera */
  conMadera?:  boolean;
}

export interface ItemPesada {
  kind:            'pesada';
  equipo:          Equipo;
  conMartillo:     boolean;
  diasSolicitados: number;
  fechaInicio:     string;
  tarifaEfectiva:  number;
}

export type ItemSolicitud = ItemMaquinaria | ItemGranel | ItemPesada;

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function getRentaRate(
  unidad: UnidadDuracion,
  dia?:    number | null,
  semana?: number | null,
  mes?:    number | null,
): number | null {
  if (unidad === 'dias')    return dia    ?? null;
  if (unidad === 'semanas') return semana ?? null;
  return mes ?? null;
}

/**
 * Calcula el subtotal de un ítem usando precios adaptativos.
 *
 * Si la unidad es 'dias' o 'semanas', la duración se descompone en
 * meses calendario + semanas + días sueltos, y cada componente se cobra
 * a su tarifa correspondiente. Esto evita cobrar 7 días × tarifa_dia
 * cuando el equipo tiene precio semanal configurado.
 */
export function calcSubtotal(item: ItemSolicitud): number {
  if (item.kind === 'pesada') return 0; // sin total estimado — se factura por horómetro
  if (item.kind === 'maquinaria') {
    const decomp = descomponerDuracion(item.fechaInicio, item.duracion, item.unidad);
    return subtotalDescompuesto(decomp, {
      dia:    item.equipo.rentaDia,
      semana: item.equipo.rentaSemana,
      mes:    item.equipo.rentaMes,
    });
  }
  if (!item.config) return 0;
  const decomp   = descomponerDuracion(item.fechaInicio, item.duracion, item.unidad);
  const tarifas  = item.conMadera
    ? { dia: item.config.rentaDiaConMadera, semana: item.config.rentaSemanaConMadera, mes: item.config.rentaMesConMadera }
    : { dia: item.config.rentaDia,          semana: item.config.rentaSemana,          mes: item.config.rentaMes          };
  return subtotalDescompuesto(decomp, tarifas) * item.cantidad;
}

export function formatQ(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formatea una fecha ISO de solo día ("2026-04-14") — añade hora local para evitar desfase UTC. */
export function formatFechaCorta(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

/** Formatea un datetime ISO completo como fecha corta ("14/04/26"). */
export function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

/** Formatea un datetime ISO completo como fecha + hora ("14/04/26 · 09:32 a. m."). */
export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function unidadLabel(n: number, u: UnidadDuracion): string {
  if (u === 'horas')   return n === 1 ? '1 hora'   : `${n} horas`;
  if (u === 'dias')    return n === 1 ? '1 día'     : `${n} días`;
  if (u === 'semanas') return n === 1 ? '1 semana'  : `${n} semanas`;
  return n === 1 ? '1 mes' : `${n} meses`;
}

export function rateSuffix(u: UnidadDuracion): string {
  return u === 'dias' ? '/día' : u === 'semanas' ? '/sem' : '/mes';
}
