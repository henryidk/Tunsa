import { create } from 'zustand';

interface ReservadosStore {
  reservedIds:   Set<string>;
  setAll:        (ids: string[]) => void;
  removeEquipos: (ids: string[]) => void;
}

export const useReservadosStore = create<ReservadosStore>((set) => ({
  reservedIds: new Set(),

  setAll: (ids) => set({ reservedIds: new Set(ids) }),

  removeEquipos: (ids) =>
    set((s) => {
      const next = new Set(s.reservedIds);
      ids.forEach(id => next.delete(id));
      return { reservedIds: next };
    }),
}));
