export const rolLabel: Record<string, string> = {
  admin:              'Administrador',
  secretaria:         'Secretaria',
  encargado_maquinas: 'Enc. de Máquinas',
};

export const rolBadge: Record<string, string> = {
  admin:              'bg-violet-100 text-violet-800',
  secretaria:         'bg-sky-100 text-sky-700',
  encargado_maquinas: 'bg-teal-100 text-teal-700',
};

export const rolGradient: Record<string, string> = {
  admin:              'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  secretaria:         'linear-gradient(135deg,#0ea5e9,#0284c7)',
  encargado_maquinas: 'linear-gradient(135deg,#14b8a6,#0d9488)',
};

export function extractApiError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  return msg ?? fallback;
}

export function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}
