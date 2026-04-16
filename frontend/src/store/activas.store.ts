import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface ActivasState {
  solicitudes:    SolicitudRenta[];
  setSolicitudes: (data: SolicitudRenta[]) => void;
  removeRenta:    (id: string) => void;
}

export const useActivasStore = create<ActivasState>((set) => ({
  solicitudes: [],

  setSolicitudes: (data) => set({ solicitudes: data }),

  removeRenta: (id) =>
    set((state) => ({
      solicitudes: state.solicitudes.filter(s => s.id !== id),
    })),
}));
