export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ACTIVA' | 'DEVUELTA';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';
export type UnidadDuracion  = 'dias' | 'semanas' | 'meses';

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
    });

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
  createdAt:      string;
  updatedAt:      string;
}
