import { Prisma } from '@prisma/client';
import type { ExtensionEntry, DevolucionEntry } from './recargo.util';

export type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }> & {
  lecturas?: { fecha: Date; horometroFin5pm: Prisma.Decimal | null }[];
};

export type SolicitudSerializada = ReturnType<typeof serializeSolicitud>;

export interface RechazadasPage {
  data:       SolicitudSerializada[];
  nextCursor: string | null;
}

export function serializeSolicitud(s: SolicitudConCliente) {
  const ultimaLectura = s.lecturas?.[0] ?? null;
  return {
    ...s,
    totalEstimado:         parseFloat(s.totalEstimado.toString()),
    recargoTotal:          s.recargoTotal != null ? parseFloat(s.recargoTotal.toString())        : null,
    totalFinal:            s.totalFinal   != null ? parseFloat((s.totalFinal as any).toString()) : null,
    costoAcumuladoPesada:  parseFloat(((s as any).costoAcumuladoPesada ?? 0).toString()),
    extensiones:           (s.extensiones          ?? null) as ExtensionEntry[]   | null,
    devolucionesParciales: (s.devolucionesParciales ?? null) as DevolucionEntry[] | null,
    fechaUltimaDevolucion: s.fechaUltimaDevolucion?.toISOString() ?? null,
    lecturas:              undefined,
    ultimaLectura:         ultimaLectura
      ? { fecha: ultimaLectura.fecha.toISOString().substring(0, 10), completa: ultimaLectura.horometroFin5pm !== null }
      : null,
  };
}
