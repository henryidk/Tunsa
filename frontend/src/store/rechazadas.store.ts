import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface RechazadasState {
  solicitudes:    SolicitudRenta[];
  setSolicitudes: (data: SolicitudRenta[]) => void;
  addRechazada:   (s: SolicitudRenta) => void;
}

/**
 * Store de solicitudes RECHAZADA del encargado.
 * Poblado por dos fuentes:
 *   - setSolicitudes: carga inicial desde API (getMiasHistorial)
 *   - addRechazada:   evento en tiempo real desde useEncargadoSocket
 */
export const useRechazadasStore = create<RechazadasState>((set) => ({
  solicitudes: [],

  setSolicitudes: (data) => set({ solicitudes: data }),

  addRechazada: (s) =>
    set((state) => ({
      solicitudes: state.solicitudes.some(r => r.id === s.id)
        ? state.solicitudes
        : [s, ...state.solicitudes],
    })),
}));
