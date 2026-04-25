import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export const ROLES_CON_ACCESO_GLOBAL = new Set(['admin', 'secretaria']);

export function tieneAccesoGlobal(user: AuthenticatedUser): boolean {
  return ROLES_CON_ACCESO_GLOBAL.has(user.role);
}
