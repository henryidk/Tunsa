import { useEffect } from 'react';
import { msMinimos } from '../utils/renta-tiempo.utils';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

/**
 * Detecta rentas que acaban de vencer (tick del reloj) y las migra
 * del store de activas al de vencidas.
 *
 * Recibe callbacks en lugar de referencias al store para desacoplarse
 * de la implementación concreta — encargado y admin usan sus propios stores.
 */
export function useActivasVencidasSync(
  solicitudes: SolicitudRenta[],
  ahora:       number,
  removeRenta: (id: string) => void,
  addVencida:  (solicitud: SolicitudRenta) => void,
): void {
  useEffect(() => {
    const recienVencidas = solicitudes.filter(s => {
      if (!s.fechaFinEstimada) return false;
      const extensiones = s.extensiones ?? [];
      const inicio      = s.fechaInicioRenta ? new Date(s.fechaInicioRenta) : new Date();
      return msMinimos(s.items, inicio, extensiones, ahora) < 0;
    });

    if (recienVencidas.length === 0) return;
    recienVencidas.forEach(s => { removeRenta(s.id); addVencida(s); });
  }, [ahora, solicitudes, removeRenta, addVencida]);
}
