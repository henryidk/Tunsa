export function formatDpi(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length > 9) return digits.slice(0, 4) + ' ' + digits.slice(4, 9) + ' ' + digits.slice(9);
  if (digits.length > 4) return digits.slice(0, 4) + ' ' + digits.slice(4);
  return digits;
}

export function formatTelefono(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits;
}
