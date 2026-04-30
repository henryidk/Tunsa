export function formatQ(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMoneda(value: number | null | undefined): string {
  if (value == null) return '—';
  return formatQ(value);
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Strings de solo fecha ("YYYY-MM-DD"): parsear como mediodía local para evitar
  // el rollover UTC→local en zonas UTC-X. Full timestamps: convertir normalmente.
  const d = iso.length === 10
    ? new Date(iso + 'T12:00:00')
    : new Date(iso);
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Extrae el mensaje de error de una respuesta Axios. */
export function extractApiError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

export function sortEquiposByNumeracion<T extends { numeracion: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aNum = /^\d+$/.test(a.numeracion);
    const bNum = /^\d+$/.test(b.numeracion);
    if (aNum && bNum) return parseInt(a.numeracion) - parseInt(b.numeracion);
    if (aNum) return -1;
    if (bNum) return 1;
    return a.numeracion.localeCompare(b.numeracion);
  });
}
