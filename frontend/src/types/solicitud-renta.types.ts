export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';

interface ItemSnapshotBase {
  fechaInicio: string;
  duracion:    number;
  unidad:      string;
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
  id:     string;
  nombre: string;
}

export interface SolicitudRenta {
  id:            string;
  clienteId:     string;
  cliente:       ClienteBasico;
  items:         ItemSnapshot[];
  modalidad:     ModalidadPago;
  notas:         string;
  totalEstimado: number;
  estado:        EstadoSolicitud;
  creadaPor:     string;
  createdAt:     string;
  updatedAt:     string;
}
