import { useState } from 'react';
import type { ItemSolicitud, ItemMaquinaria, ItemGranel } from '../types/solicitud.types';
import { calcSubtotal } from '../types/solicitud.types';

interface CartSummary {
  total:         number;
  countMaquinaria: number;
  countGranel:   number;
}

interface SolicitudCart {
  items:         ItemSolicitud[];
  summary:       CartSummary;
  addMaquinaria: (item: Omit<ItemMaquinaria, 'kind'>) => void;
  addGranel:     (item: Omit<ItemGranel, 'kind'>) => void;
  removeAt:      (idx: number) => void;
  clear:         () => void;
  hasEquipo:     (equipoId: string) => boolean;
  hasGranel:     (tipo: string) => boolean;
}

export function useSolicitudCart(): SolicitudCart {
  const [items, setItems] = useState<ItemSolicitud[]>([]);

  const addMaquinaria = (item: Omit<ItemMaquinaria, 'kind'>) =>
    setItems(prev => [...prev, { kind: 'maquinaria', ...item }]);

  const addGranel = (item: Omit<ItemGranel, 'kind'>) =>
    setItems(prev => [
      ...prev.filter(i => !(i.kind === 'granel' && i.tipo === item.tipo)),
      { kind: 'granel', ...item },
    ]);

  const removeAt = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const clear = () => setItems([]);

  const hasEquipo = (equipoId: string) =>
    items.some(i => i.kind === 'maquinaria' && i.equipo.id === equipoId);

  const hasGranel = (tipo: string) =>
    items.some(i => i.kind === 'granel' && i.tipo === tipo);

  const summary: CartSummary = {
    total:          items.reduce((s, i) => s + calcSubtotal(i), 0),
    countMaquinaria: items.filter(i => i.kind === 'maquinaria').length,
    countGranel:    items.filter(i => i.kind === 'granel').length,
  };

  return { items, summary, addMaquinaria, addGranel, removeAt, clear, hasEquipo, hasGranel };
}
