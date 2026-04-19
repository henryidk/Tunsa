import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface ActivasState {
  solicitudes:    SolicitudRenta[];
  setSolicitudes: (data: SolicitudRenta[]) => void;
  addRenta:       (solicitud: SolicitudRenta) => void;
  updateRenta:    (solicitud: SolicitudRenta) => void;
  removeRenta:    (id: string) => void;
}

function createActivasStore() {
  return create<ActivasState>((set) => ({
    solicitudes: [],

    setSolicitudes: (data) => set({ solicitudes: data }),

    addRenta: (solicitud) =>
      set((state) => ({
        solicitudes: state.solicitudes.some(s => s.id === solicitud.id)
          ? state.solicitudes
          : [solicitud, ...state.solicitudes],
      })),

    updateRenta: (solicitud) =>
      set((state) => ({
        solicitudes: state.solicitudes.map(s => s.id === solicitud.id ? solicitud : s),
      })),

    removeRenta: (id) =>
      set((state) => ({
        solicitudes: state.solicitudes.filter(s => s.id !== id),
      })),
  }));
}

export const useActivasStore      = createActivasStore();
export const useAdminActivasStore = createActivasStore();
