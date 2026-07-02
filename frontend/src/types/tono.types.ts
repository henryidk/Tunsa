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

export const TONO_BRAND: TonoSistema = {
  boton:        'bg-brand-600 hover:bg-brand-700',
  botonTexto:   'text-white',
  acento:       'bg-brand-50 text-brand-700 border-brand-200',
  acentoFuerte: 'bg-brand-600 text-white',
  texto:        'text-brand-700',
  textoBorde:   'border-brand-400',
  foco:         'focus:border-brand-400 focus:ring-2 focus:ring-brand-100',
  link:         'text-brand-600 hover:text-brand-800',
};
