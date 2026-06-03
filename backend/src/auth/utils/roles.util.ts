import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export const ROLES_CON_ACCESO_GLOBAL = new Set(['admin', 'secretaria']);

export function tieneAccesoGlobal(user: AuthenticatedUser): boolean {
  return ROLES_CON_ACCESO_GLOBAL.has(user.role);
}

export function puedeGestionarSolicitud(
  user: AuthenticatedUser,
  solicitud: { creadaPor: string; gestionadaPor?: string | null },
): boolean {
  if (tieneAccesoGlobal(user)) return true;
  if (solicitud.creadaPor    === user.username) return true;
  if (solicitud.gestionadaPor === user.username) return true;
  return false;
}
