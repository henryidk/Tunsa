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

/** Devuelve true para los kinds que tienen un equipo físico identificado por equipoId. */
export function tieneEquipoId(kind: string): boolean {
  return kind === 'maquinaria' || kind === 'pesada';
}

/** Shape genérica para calcular costos, fechas y recarsos en rentas livianas y granel. */
export interface ItemParaCalculo {
  kind:          string;
  duracion:      number;
  unidad:        string;
  tarifa:        number | null;
  /** Tarifas explícitas fijadas por el admin (override) por período.
   *  Cuando está presente, se usa en lugar del catálogo para calcular costoReal y recargoTiempo. */
  tarifaFijada?: { dia: number | null; semana: number | null; mes: number | null } | null;
  equipoId?:     string;
  tipo?:         string;
  conMadera?:    boolean;
  cantidad?:     number;
}

/** Un extra seleccionado al crear la solicitud (snapshot inmutable). */
export interface ExtraSeleccionadoSnapshot {
  tipoExtraId: string;
  nombre:      string;
  rentaHora:   number;
  /** Precio de catálogo de este extra al momento de crear la solicitud. Null = no se pudo resolver contra el catálogo. */
  catalogoRentaHora?: number | null;
}

/** Shape completa de un ítem de maquinaria pesada. */
export interface ItemPesadaSnapshot {
  kind:            'pesada';
  equipoId:        string;
  numeracion:      string;
  descripcion:     string;
  extras:          ExtraSeleccionadoSnapshot[];  // complementos disponibles para esta renta (no "incluidos" en el precio)
  tarifaEfectiva:  number;  // rentaHora BASE del equipo (sin complemento) — puede venir de tarifaBaseFijada
  /** Tarifa base pactada por el usuario, distinta a la de catálogo. Null/undefined = se usó la de catálogo. */
  tarifaBaseFijada?: number | null;
  /** Precio base de catálogo al momento de crear la solicitud, para comparar contra lo pactado. Null = no se pudo resolver. */
  tarifaCatalogo?: number | null;
  diasSolicitados?: number;
  duracion:        number;
  unidad:          string;
  subtotal:        number;
}

/** Un tramo cerrado del día: intervalo de horómetro con/sin complemento y su costo. */
export interface TramoHorometro {
  horometroDesde: number;
  horometroHasta: number;
  horas:          number;
  extraId:        string | null;  // complemento activo durante este tramo; null = sin complemento
  extraNombre:    string | null;
  tarifa:         number;         // tarifaBase, o tarifaBase + rentaHora del extra
  costo:          number;         // horas * tarifa
}

/** Punto de corte indicado por el usuario para dividir la noche en varios tramos. */
export interface CorteNocturnoInput {
  horometroCorte: number;
  extraId:        string | null;  // complemento que aplica DESDE este corte en adelante
}

/** Total de horas/costo acumulado por estado de complemento y franja horaria, a lo largo de toda la renta de un equipo. */
export interface DesgloseComplemento {
  extraId:     string | null;  // null = sin complemento
  extraNombre: string | null;
  periodo:     'diurno' | 'nocturno';
  tarifa:      number;         // Q/hr aplicada a este grupo (ya incluye recargo nocturno y/o rentaHora del extra)
  horas:       number;
  costo:       number;
}
