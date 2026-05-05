export const rolLabel: Record<string, string> = {
  admin:              'Administrador',
  secretaria:         'Secretaria',
  encargado_maquinas: 'Enc. de Máquinas',
};

export const rolBadge: Record<string, string> = {
  admin:              'bg-violet-100 text-violet-800',
  secretaria:         'bg-sky-100 text-sky-700',
  encargado_maquinas: 'bg-indigo-100 text-indigo-700',
};

export const rolGradient: Record<string, string> = {
  admin:              'linear-gradient(135deg,#6366f1,#4f46e5)',
  secretaria:         'linear-gradient(135deg,#06b6d4,#0891b2)',
  encargado_maquinas: 'linear-gradient(135deg,#f59e0b,#d97706)',
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
