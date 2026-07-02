import { useState } from 'react';
import type { Equipo } from '../types/equipo.types';
import type { ExtraSeleccionado } from '../types/solicitud-renta.types';

/** Forma mínima que necesita este hook — la satisfacen tanto PesadaItem (Nueva Renta Pesada) como PesadaItemRetro (Retroactiva). */
export interface ItemConTarifaPesada {
  equipo:              Equipo;
  extrasSeleccionados: ExtraSeleccionado[];
  tarifaBaseEfectiva:  number;
}

/**
 * Estado y lógica para editar la tarifa base + complementos de un ítem de maquinaria pesada
 * en el carrito, con override sobre el catálogo. Usado por Nueva Renta Pesada, Renta Retroactiva
 * y Nueva Solicitud Pesada (encargado).
 */
export function useTarifaPesadaEdit<T extends ItemConTarifaPesada>(item: T, onUpdateItem: (item: T) => void) {
  const catalogBase   = item.equipo.rentaHora ?? 0;
  const tieneOverride = item.tarifaBaseEfectiva !== catalogBase;

  const [editing,     setEditing]     = useState(false);
  const [baseInput,   setBaseInput]   = useState('');
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});

  const startEdit = () => {
    setBaseInput(String(item.tarifaBaseEfectiva));
    const inputs: Record<string, string> = {};
    item.extrasSeleccionados.forEach(e => { inputs[e.tipoExtraId] = String(e.rentaHora); });
    setExtraInputs(inputs);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const setExtraInput = (tipoExtraId: string, valor: string) =>
    setExtraInputs(prev => ({ ...prev, [tipoExtraId]: valor }));

  const commitEdit = () => {
    const nuevaBase = parseFloat(baseInput);
    if (isNaN(nuevaBase) || nuevaBase < 0) return;
    const nuevosExtras = item.extrasSeleccionados.map(e => {
      const val = parseFloat(extraInputs[e.tipoExtraId]);
      return isNaN(val) || val < 0 ? e : { ...e, rentaHora: val };
    });
    onUpdateItem({ ...item, tarifaBaseEfectiva: nuevaBase, extrasSeleccionados: nuevosExtras });
    setEditing(false);
  };

  const restablecer = () => {
    const nuevosExtras = item.extrasSeleccionados.map(e => {
      const catalogExtra = item.equipo.extras.find(ex => ex.tipoExtraId === e.tipoExtraId);
      return catalogExtra ? { ...e, rentaHora: catalogExtra.rentaHora } : e;
    });
    onUpdateItem({ ...item, tarifaBaseEfectiva: catalogBase, extrasSeleccionados: nuevosExtras });
    setEditing(false);
  };

  return {
    catalogBase, tieneOverride,
    editing, startEdit, cancelEdit,
    baseInput, setBaseInput,
    extraInputs, setExtraInput,
    commitEdit, restablecer,
  };
}
