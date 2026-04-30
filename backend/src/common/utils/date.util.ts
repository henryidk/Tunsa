// Guatemala es UTC-6 permanente (sin horario de verano).
// Esta constante hace que qualquier `new Date()` UTC se convierta correctamente
// a fecha local sin depender de la zona horaria del servidor ni del contenedor.
const GT_OFFSET_MS = -6 * 60 * 60_000;

/**
 * Devuelve la fecha actual en Guatemala como "YYYY-MM-DD".
 * Usar siempre que el backend necesite registrar "hoy" en un campo @db.Date.
 */
export function fechaHoyGT(): string {
  return fechaGT(new Date());
}

/**
 * Convierte cualquier Date (UTC) a "YYYY-MM-DD" en hora de Guatemala.
 * Útil para auditoría o campos de solo-fecha derivados de timestamps.
 */
export function fechaGT(d: Date): string {
  const local = new Date(d.getTime() + GT_OFFSET_MS);
  const yyyy  = local.getUTCFullYear();
  const mm    = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd    = String(local.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Devuelve el inicio del día actual en Guatemala como Date UTC.
 * Medianoche Guatemala = UTC+6h → "YYYY-MM-DDT06:00:00.000Z".
 * Usar para queries que filtran registros de "hoy" por createdAt.
 */
export function inicioHoyGT(): Date {
  return new Date(fechaHoyGT() + 'T06:00:00.000Z');
}
