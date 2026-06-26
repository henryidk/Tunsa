export type EstadoProyecto = 'ACTIVO' | 'FINALIZADO';

export interface ProyectoResumen {
  id:         string;
  nombre:     string;
  clienteId?: string;
}

export interface Proyecto {
  id:          string;        // "PROY-0001"
  nombre:      string;
  descripcion: string | null;
  clienteId:   string;
  cliente:     { id: string; nombre: string };
  estado:      EstadoProyecto;
  fechaInicio: string;        // ISO date "2026-06-24"
  fechaFin:    string | null;
  creadoPor:   string;
  createdAt:   string;
  updatedAt:   string;
  _count:             { solicitudes: number };
  solicitudesActivas: number;
  equiposEnCampo:     number;
  costoAcumulado:     number;
}

export interface ProyectoSolicitudes {
  enProceso: import('./solicitud-renta.types').SolicitudRenta[];
  activas:   import('./solicitud-renta.types').SolicitudRenta[];
  vencidas:  import('./solicitud-renta.types').SolicitudRenta[];
  devueltas: import('./solicitud-renta.types').SolicitudRenta[];
}

export interface CreateProyectoData {
  nombre:        string;
  descripcion?:  string;
  clienteId:     string;
  encargadoIds?: string[];
}

export interface UpdateProyectoData {
  nombre?:      string;
  descripcion?: string;
}
