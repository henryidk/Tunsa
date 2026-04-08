export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type ModalidadPago   = 'CONTADO' | 'CREDITO';

export interface ItemSnapshot {
  kind:        'maquinaria' | 'granel';
  // Maquinaria
  equipoId?:   string;
  numeracion?: string;
  descripcion?:string;
  // Granel
  tipo?:       string;
  tipoLabel?:  string;
  cantidad?:   number;
  conMadera?:  boolean;
  // Común
  fechaInicio: string;
  duracion:    number;
  unidad:      string;
  tarifa:      number | null;
  subtotal:    number;
}

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
