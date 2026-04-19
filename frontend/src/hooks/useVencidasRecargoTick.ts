import { useEffect, useState } from 'react';
import { proximoCambioGlobal } from '../utils/renta-tiempo.utils';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

/**
 * Tick inteligente para el cálculo de recargos en rentas vencidas.
 *
 * Solo despierta cuando realmente cambia el monto del recargo:
 * - Dentro de la gracia (1h): despierta al terminar la gracia.
 * - Pasada la gracia: despierta cada 24h (cuando se acumula un día más de recargo).
 *
 * Devuelve el timestamp `ahoraRecargo` que debe usarse para calcular montos.
 */
export function useVencidasRecargoTick(solicitudes: SolicitudRenta[]): number {
  const [ahoraRecargo, setAhoraRecargo] = useState(() => Date.now());

  useEffect(() => {
    if (solicitudes.length === 0) return;
    const next  = proximoCambioGlobal(solicitudes, ahoraRecargo);
    const delay = next - Date.now();
    if (delay <= 0) { setAhoraRecargo(Date.now()); return; }
    const id = setTimeout(() => setAhoraRecargo(Date.now()), delay);
    return () => clearTimeout(id);
  }, [solicitudes, ahoraRecargo]);

  return ahoraRecargo;
}
