export interface TonoSistema {
  boton:        string;
  botonTexto:   string;
  acento:       string;
  acentoFuerte: string;
  texto:        string;
  textoBorde:   string;
  foco:         string;
  link:         string;
}

export const TONO_INDIGO: TonoSistema = {
  boton:        'bg-indigo-600 hover:bg-indigo-700',
  botonTexto:   'text-white',
  acento:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  acentoFuerte: 'bg-indigo-600 text-white',
  texto:        'text-indigo-700',
  textoBorde:   'border-indigo-400',
  foco:         'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
  link:         'text-indigo-600 hover:text-indigo-800',
};

export const TONO_AMBAR: TonoSistema = {
  boton:        'bg-amber-500 hover:bg-amber-600',
  botonTexto:   'text-white',
  acento:       'bg-amber-50 text-amber-700 border-amber-200',
  acentoFuerte: 'bg-amber-500 text-white',
  texto:        'text-amber-700',
  textoBorde:   'border-amber-400',
  foco:         'focus:border-amber-400 focus:ring-2 focus:ring-amber-100',
  link:         'text-amber-600 hover:text-amber-800',
};
