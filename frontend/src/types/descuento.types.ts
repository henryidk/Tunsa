export type TipoDescuento = 'monto_fijo' | 'porcentaje';

export interface DescuentoAplicado {
  tipo:          TipoDescuento;
  valor:         number;
  montoOriginal: number;
  montoFinal:    number;
}

export interface DescuentoFormState {
  aplicar: boolean;
  tipo:    TipoDescuento;
  valor:   string;
}

export const DESCUENTO_INICIAL: DescuentoFormState = {
  aplicar: false,
  tipo:    'porcentaje',
  valor:   '',
};

/**
 * Calcula el descuento final. Retorna null si el estado es inválido.
 * Función pura: sin efectos secundarios.
 */
export function calcularDescuento(
  estado:    DescuentoFormState,
  montoBase: number,
): DescuentoAplicado | null {
  if (!estado.aplicar) return null;
  const val = parseFloat(estado.valor);
  if (isNaN(val) || val <= 0) return null;

  if (estado.tipo === 'monto_fijo') {
    if (val >= montoBase) return null;
    return { tipo: 'monto_fijo', valor: val, montoOriginal: montoBase, montoFinal: montoBase - val };
  }

  if (val >= 100) return null;
  const montoFinal = montoBase * (1 - val / 100);
  return { tipo: 'porcentaje', valor: val, montoOriginal: montoBase, montoFinal };
}

export function descuentoEsValido(
  estado:    DescuentoFormState,
  montoBase: number,
): boolean {
  if (!estado.aplicar) return true;
  return calcularDescuento(estado, montoBase) !== null;
}
