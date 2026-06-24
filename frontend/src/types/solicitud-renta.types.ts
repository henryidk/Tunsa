export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ACTIVA' | 'DEVUELTA';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';
export type UnidadDuracion  = 'dias' | 'semanas' | 'meses' | 'horas';

/** Snapshot de un extra seleccionado al crear la solicitud. */
export interface ExtraSeleccionado {
  tipoExtraId: string;
  nombre:      string;
  rentaHora:   number;
}

/** Cargo adicional por condición del equipo (daños, faltantes, etc.). */
export interface CargoAdicional {
  descripcion: string;
  monto:       number;
}

/** Detalle de facturación de un ítem dentro de una devolución. */
export interface DevolucionItemEntry {
  itemRef:       string;
  kind:          'maquinaria' | 'granel' | 'pesada';
  diasCobrados:  number;
  costoReal:     number;
  recargoTiempo: number;
  desglose?:     { meses: number; semanas: number; dias: number };
  tarifas?:      { dia: number | null; semana: number | null; mes: number | null };
}

/** Registro de un evento de devolución (parcial o completo). */
export interface DevolucionEntry {
  fechaDevolucion:     string;
  registradoPor:       string;
  esParcial:           boolean;
  tipoDevolucion:      'A_TIEMPO' | 'TARDIA';
  items:               DevolucionItemEntry[];
  recargosAdicionales: CargoAdicional[];
  descuento?:          import('./descuento.types').DescuentoAplicado;
  totalLote:           number;
  liquidacionKey:      string | null;
  detalleHorometroKey?: string | null;
}

/** Una extensión aplicada a un ítem de la renta. */
export interface ExtensionEntry {
  itemRef:        string;                    // equipoId para maquinaria; tipo para granel
  kind:           'maquinaria' | 'granel' | 'pesada';
  duracion:       number;
  unidad:         UnidadDuracion;
  costoExtra:     number;
  tipo:           'gracia' | 'ampliacion';
  fechaExtension: string;                    // ISO timestamp
}

interface ItemSnapshotBase {
  fechaInicio:  string;
  duracion?:    number;
  unidad?:      UnidadDuracion;
  tarifa:       number | null;
  tarifaFijada?: { dia: number | null; semana: number | null; mes: number | null } | null;
  subtotal:     number;
  desglose?:    { meses: number; semanas: number; dias: number };
  tarifas?:     { dia: number | null; semana: number | null; mes: number | null };
}

export type ItemSnapshot =
  | (ItemSnapshotBase & {
      kind:        'maquinaria';
      equipoId:    string;
      numeracion:  string;
      descripcion: string;
    })
  | (ItemSnapshotBase & {
      kind:      'granel';
      tipo:      string;
      tipoLabel: string;
      cantidad:  number;
      conMadera: boolean;
    })
  | {
      kind:              'pesada';
      equipoId:          string;
      numeracion:        string;
      descripcion:       string;
      extras:            ExtraSeleccionado[];
      diasSolicitados:   number;
      tarifaEfectiva:    number;
      tarifaBaseFijada?: number | null;
      fechaInicio:       string;
      duracion:          number;
      unidad:            UnidadDuracion;
      subtotal:          number;
      horometroInicial?: number;
    };

export interface ClienteBasico {
  id:           string;
  nombre:       string;
  dpi:          string | null;
  telefono?:    string | null;
  esEspecial:   boolean;
  documentoKey: string | null;
}

export interface SolicitudRenta {
  id:             string;
  clienteId:      string;
  cliente:        ClienteBasico;
  proyecto:       import('./proyecto.types').ProyectoResumen | null;
  items:          ItemSnapshot[];
  modalidad:      ModalidadPago;
  notas:          string;
  motivoRechazo:  string | null;
  totalEstimado:  number;
  esPesada:        boolean;
  esIndefinida?:   boolean;
  estado:          EstadoSolicitud;
  creadaPor:       string;
  gestionadaPor:   string | null;
  nombreCreador:   string | null;
  nombreAprobador: string | null;
  nombreGestor:    string | null;
  folio:          string | null;
  aprobadaPor:    string | null;
  fechaDecision:    string | null;
  comprobanteKey:   string | null;
  fechaInicioRenta: string | null;
  fechaEntrega:     string | null;
  fechaFinEstimada: string | null;
  fechaDevolucion:  string | null;
  recargoTotal:     number | null;
  extensiones:           ExtensionEntry[]   | null;
  devolucionesParciales: DevolucionEntry[]  | null;
  totalFinal:            number             | null;
  fechaUltimaDevolucion: string             | null;
  costoAcumuladoPesada:  number;
  ultimaLectura:         { fecha: string; completa: boolean } | null;
  createdAt:      string;
  updatedAt:      string;
}
