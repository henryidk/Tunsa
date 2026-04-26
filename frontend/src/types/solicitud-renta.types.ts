export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ACTIVA' | 'DEVUELTA';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';
export type UnidadDuracion  = 'dias' | 'semanas' | 'meses' | 'horas';

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
}

/** Registro de un evento de devolución (parcial o completo). */
export interface DevolucionEntry {
  fechaDevolucion:     string;
  registradoPor:       string;
  esParcial:           boolean;
  tipoDevolucion:      'A_TIEMPO' | 'TARDIA';
  items:               DevolucionItemEntry[];
  recargosAdicionales: CargoAdicional[];
  totalLote:           number;
  liquidacionKey:      string | null;
}

/** Una extensión aplicada a un ítem de la renta. */
export interface ExtensionEntry {
  itemRef:        string;                    // equipoId para maquinaria; tipo para granel
  kind:           'maquinaria' | 'granel' | 'pesada';
  duracion:       number;
  unidad:         UnidadDuracion;
  costoExtra:     number;
  fechaExtension: string;                    // ISO timestamp
}

interface ItemSnapshotBase {
  fechaInicio: string;
  duracion:    number;
  unidad:      UnidadDuracion;
  tarifa:      number | null;
  subtotal:    number;
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
      conMartillo:       boolean;
      diasSolicitados:   number;
      tarifaEfectiva:    number;
      fechaInicio:       string;
      duracion:          number;
      unidad:            UnidadDuracion;
      subtotal:          number;
      horometroInicial?: number;
    };

export interface ClienteBasico {
  id:           string;
  nombre:       string;
  dpi:          string;
  telefono?:    string | null;
  documentoKey: string | null;
}

export interface SolicitudRenta {
  id:             string;
  clienteId:      string;
  cliente:        ClienteBasico;
  items:          ItemSnapshot[];
  modalidad:      ModalidadPago;
  notas:          string;
  motivoRechazo:  string | null;
  totalEstimado:  number;
  esPesada:       boolean;
  estado:         EstadoSolicitud;
  creadaPor:      string;
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
