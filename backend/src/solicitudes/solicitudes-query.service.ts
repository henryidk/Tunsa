import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeSolicitud, SolicitudConCliente, RechazadasPage } from './solicitudes.serializer';
import type { DevolucionEntry } from './recargo.util';

interface ItemConKind { kind: string; equipoId?: string }

interface KeysetCursor    { fechaDecision:         string; id: string }
interface HistorialCursor { fechaUltimaDevolucion: string; id: string }

const PAGE_SIZE = 20;

@Injectable()
export class SolicitudesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve los IDs de equipos bloqueados: PENDIENTE, APROBADA o ACTIVA.
   * Un equipo en renta activa sigue ocupado hasta que la renta finalice.
   */
  async getEquiposReservados(): Promise<string[]> {
    const activas = await this.prisma.solicitud.findMany({
      where:  { estado: { in: ['PENDIENTE', 'APROBADA', 'ACTIVA'] } },
      select: { items: true, devolucionesParciales: true },
    });

    const reservados = new Set<string>();
    for (const s of activas) {
      const devoluciones = (s.devolucionesParciales as unknown as DevolucionEntry[]) ?? [];
      const yaDevueltos  = new Set<string>(
        devoluciones.flatMap(d => d.items.map(i => i.itemRef)),
      );
      const items = s.items as unknown as ItemConKind[];
      for (const item of items) {
        if ((item.kind === 'maquinaria' || item.kind === 'pesada') && item.equipoId && !yaDevueltos.has(item.equipoId)) {
          reservados.add(item.equipoId);
        }
      }
    }

    return [...reservados];
  }

  /**
   * Solo devuelve PENDIENTE y APROBADA — las solicitudes activas que el admin gestiona.
   * RECHAZADA se consulta aparte vía findRechazadas() con paginación keyset.
   */
  async findAll() {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: { in: ['PENDIENTE', 'APROBADA'] } },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(serializeSolicitud);
  }

  async findMias(username: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { creadaPor: username, estado: { in: ['PENDIENTE', 'APROBADA'] } },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(serializeSolicitud);
  }

  async findVencidas() {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: 'ACTIVA', fechaFinEstimada: { lt: now } },
      include: { cliente: true },
      orderBy: { fechaFinEstimada: 'asc' },
    });
    return solicitudes.map(serializeSolicitud);
  }

  async findActivas() {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: 'ACTIVA' },
      include: { cliente: true },
      orderBy: { fechaEntrega: 'desc' },
    });
    return solicitudes.map(serializeSolicitud);
  }

  async findActivasMias(username: string) {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor: username,
        estado:    'ACTIVA',
        OR: [
          { fechaFinEstimada: null },
          { fechaFinEstimada: { gte: now } },
        ],
      },
      include: {
        cliente:  true,
        lecturas: { orderBy: { fecha: 'desc' }, take: 1 },
      },
      orderBy: { fechaEntrega: 'desc' },
    });
    return solicitudes.map(s => serializeSolicitud(s as SolicitudConCliente));
  }

  async findVencidasMias(username: string) {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor:        username,
        estado:           'ACTIVA',
        fechaFinEstimada: { lt: now },
      },
      include: { cliente: true },
      orderBy: { fechaFinEstimada: 'asc' },
    });
    return solicitudes.map(serializeSolicitud);
  }

  /**
   * Paginación keyset sobre solicitudes RECHAZADA filtradas por rango de fecha.
   * Orden: fechaDecision DESC, id DESC.
   */
  async findRechazadas(params: {
    fechaDesde: Date;
    fechaHasta: Date;
    cursor?:    string;
  }): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado:        'RECHAZADA',
        fechaDecision: { gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { fechaDecision: { lt: keysetClause.fechaDecision } },
            { fechaDecision: keysetClause.fechaDecision, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaDecision: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeCursor({ fechaDecision: last.fechaDecision!.toISOString(), id: last.id })
      : null;

    return { data: pageData.map(serializeSolicitud), nextCursor };
  }

  /**
   * Historial de rentas del encargado: solicitudes con al menos una devolución registrada,
   * filtradas por la fecha de la última devolución.
   */
  async findHistorialMias(
    username: string,
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor:             username,
        estado:                { in: ['ACTIVA', 'DEVUELTA'] },
        fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { fechaUltimaDevolucion: { lt: keysetClause.fechaUltimaDevolucion } },
            { fechaUltimaDevolucion: keysetClause.fechaUltimaDevolucion, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaUltimaDevolucion: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeHistorialCursor({
          fechaUltimaDevolucion: last.fechaUltimaDevolucion!.toISOString(),
          id: last.id,
        })
      : null;

    return { data: pageData.map(serializeSolicitud), nextCursor };
  }

  /**
   * Historial global de rentas (admin / secretaria): igual que findHistorialMias
   * pero sin filtro de encargado.
   */
  async findHistorial(
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado:                { in: ['ACTIVA', 'DEVUELTA'] },
        fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { fechaUltimaDevolucion: { lt: keysetClause.fechaUltimaDevolucion } },
            { fechaUltimaDevolucion: keysetClause.fechaUltimaDevolucion, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaUltimaDevolucion: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeHistorialCursor({
          fechaUltimaDevolucion: last.fechaUltimaDevolucion!.toISOString(),
          id: last.id,
        })
      : null;

    return { data: pageData.map(serializeSolicitud), nextCursor };
  }

  // ── Cursor helpers ────────────────────────────────────────────────────────────

  private encodeCursor(cursor: KeysetCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeCursor(raw: string): { fechaDecision: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as KeysetCursor;
    return { fechaDecision: new Date(parsed.fechaDecision), id: parsed.id };
  }

  private encodeHistorialCursor(cursor: HistorialCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeHistorialCursor(raw: string): { fechaUltimaDevolucion: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as HistorialCursor;
    return { fechaUltimaDevolucion: new Date(parsed.fechaUltimaDevolucion), id: parsed.id };
  }
}
