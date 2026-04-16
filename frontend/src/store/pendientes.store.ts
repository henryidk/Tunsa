import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface PendientesState {
  solicitudes:     SolicitudRenta[];
  setSolicitudes:  (data: SolicitudRenta[]) => void;
  addSolicitud:    (solicitud: SolicitudRenta) => void;
  removeSolicitud: (id: string) => void;
}

export const usePendientesStore = create<PendientesState>((set) => ({
  solicitudes: [],

  setSolicitudes: (data) => set({ solicitudes: data }),

  addSolicitud: (solicitud) =>
    set((state) => ({
      solicitudes: [solicitud, ...state.solicitudes],
    })),

  removeSolicitud: (id) =>
    set((state) => ({
      solicitudes: state.solicitudes.filter(s => s.id !== id),
    })),
}));
