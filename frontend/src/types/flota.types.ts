export type FlotaEstado = 'disponible' | 'en-renta' | 'vencida';

export interface FlotaRentaInfo {
  id:               string;
  folio:            string | null;
  clienteNombre:    string;
  fechaFinEstimada: string | null;
  esPesada:         boolean;
  creadaPor:        string;
  proyecto:         { id: string; nombre: string } | null;
}

export interface FlotaItem {
  equipoId:    string;
  numeracion:  string;
  descripcion: string;
  categoria:   string | null;
  esPesada:    boolean;
  estado:      FlotaEstado;
  renta?:      FlotaRentaInfo;
}
