export function puedeGestionarUsuario(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'admin' && actorRole !== 'admin') return false;
  return true;
}
