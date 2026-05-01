export type ModalidadTipo = 'LIVIANA' | 'PESADA' | 'USO_PROPIO';

// Tipo de equipo tal como viene de la API (tipos_equipo)
export interface TipoEquipo {
  id:       string;        // 'tipo_liviana' | 'tipo_pesada' | 'tipo_uso'
  nombre:   string;        // etiqueta editable por el admin — solo para display
  modalidad: ModalidadTipo; // comportamiento de negocio — nunca editable desde UI
}

// Categoría tal como viene de la API
export interface Categoria {
  id:     string;
  nombre: string;
  tipoId: string;
}

// Tipo con sus categorías anidadas (respuesta de GET /categorias/tipos)
export interface TipoConCategorias extends TipoEquipo {
  categorias: Omit<Categoria, 'tipoId'>[];
}

export interface Equipo {
  id:          string;
  numeracion:  string;
  descripcion: string;
  serie:       string | null;
  fechaCompra: string;
  montoCompra: number;

  tipoId:      string;
  tipo:        TipoEquipo;

  categoriaId: string | null;
  categoria:   Categoria | null;

  rentaHora:         number | null;
  rentaHoraMartillo: number | null;
  rentaDia:          number | null;
  rentaSemana:       number | null;
  rentaMes:          number | null;

  isActive:    boolean;
  motivoBaja:  string | null;
  fechaBaja:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

export const TIPO_BADGE: Record<string, string> = {
  LIVIANA:    'bg-blue-100 text-blue-700',
  PESADA:     'bg-amber-100 text-amber-700',
  USO_PROPIO: 'bg-slate-100 text-slate-600',
};
