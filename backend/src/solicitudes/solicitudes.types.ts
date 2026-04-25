/**
 * Tipos que describen la estructura del JSON almacenado en `solicitud.items`.
 * Son snapshots tomados en el momento de crear la solicitud — no se modifican
 * después, por lo que se leen con casts explícitos desde los servicios.
 */

/** Shape mínima para leer kind y equipoId sin asumir campos adicionales. */
export interface ItemConKind {
  kind:      string;
  equipoId?: string;
}

/** Shape genérica para calcular costos, fechas y recarsos en rentas livianas y granel. */
export interface ItemParaCalculo {
  kind:       string;
  duracion:   number;
  unidad:     string;
  tarifa:     number | null;
  equipoId?:  string;
  tipo?:      string;
  conMadera?: boolean;
  cantidad?:  number;
}

/** Shape completa de un ítem de maquinaria pesada. */
export interface ItemPesadaSnapshot {
  kind:            'pesada';
  equipoId:        string;
  numeracion:      string;
  descripcion:     string;
  conMartillo:     boolean;
  tarifaEfectiva:  number;
  diasSolicitados: number;
  duracion:        number;
  unidad:          string;
  subtotal:        number;
}
