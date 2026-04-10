import { create } from 'zustand';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

interface SolicitudesState {
  solicitudes: SolicitudRenta[];
  isLoading:   boolean;
  error:       string | null;

  setSolicitudes:  (data: SolicitudRenta[]) => void;
  addSolicitud:    (nueva: SolicitudRenta) => void;
  updateEstado:    (id: string, estado: SolicitudRenta['estado']) => void;
  setLoading:      (v: boolean) => void;
  setError:        (e: string | null) => void;
}

export const useSolicitudesStore = create<SolicitudesState>((set) => ({
  solicitudes: [],
  isLoading:   true,
  error:       null,

  setSolicitudes: (data) =>
    set((state) => {
      // Preserva solicitudes ya añadidas por socket antes de que retornara el REST
      const restIds    = new Set(data.map(s => s.id));
      const viaSocket  = state.solicitudes.filter(s => !restIds.has(s.id));
      return { solicitudes: [...viaSocket, ...data] };
    }),

  addSolicitud: (nueva) =>
    set((state) => ({
      solicitudes: state.solicitudes.some(s => s.id === nueva.id)
        ? state.solicitudes
        : [nueva, ...state.solicitudes],
    })),

  updateEstado: (id, estado) =>
    set((state) => ({
      solicitudes: state.solicitudes.map(s => s.id === id ? { ...s, estado } : s),
    })),

  setLoading: (v) => set({ isLoading: v }),
  setError:   (e) => set({ error: e }),
}));

// Selectores reutilizables
export const selectPendingCount = (state: SolicitudesState) =>
  state.solicitudes.filter(s => s.estado === 'PENDIENTE').length;

export const selectTodayCount = (state: SolicitudesState) => {
  const todayStr = new Date().toDateString();
  return state.solicitudes.filter(
    s => new Date(s.createdAt).toDateString() === todayStr
  ).length;
};
