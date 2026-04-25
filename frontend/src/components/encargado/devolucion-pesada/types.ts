import type { SolicitudRenta, ItemSnapshot } from '../../../types/solicitud-renta.types';

export type Paso = 1 | 2 | 3 | 4 | 'resultado';

export interface ItemRetorno {
  equipoId:            string;
  numeracion:          string;
  descripcion:         string;
  conMartillo:         boolean;
  tarifaEfectiva:      number;
  horometroDevolucion: string;
  seleccionado:        boolean;
}

export interface CargoRow {
  descripcion: string;
  monto:       number | '';
}

export function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

type PesadaItem = Extract<ItemSnapshot, { kind: 'pesada' }>;

export function getPendientes(solicitud: SolicitudRenta): PesadaItem[] {
  const devueltos = new Set(
    (solicitud.devolucionesParciales ?? []).flatMap(d => d.items.map(i => i.itemRef)),
  );
  return (solicitud.items as ItemSnapshot[])
    .filter((i): i is PesadaItem => i.kind === 'pesada' && !devueltos.has(i.equipoId));
}
