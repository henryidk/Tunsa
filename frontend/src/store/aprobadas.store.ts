import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface AprobadasState {
  solicitudes:     SolicitudRenta[];
  setSolicitudes:  (data: SolicitudRenta[]) => void;
  addAprobada:     (solicitud: SolicitudRenta) => void;
  removeSolicitud: (id: string) => void;
}

export const useAprobadasStore = create<AprobadasState>((set) => ({
  solicitudes: [],

  setSolicitudes: (data) => set({ solicitudes: data }),

  addAprobada: (solicitud) =>
    set((state) => ({
      solicitudes: [solicitud, ...state.solicitudes],
    })),

  removeSolicitud: (id) =>
    set((state) => ({
      solicitudes: state.solicitudes.filter(s => s.id !== id),
    })),
}));
